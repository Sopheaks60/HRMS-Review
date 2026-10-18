import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { EVENTS } from "@krompay/shared";
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { CurrentUser, type AuthPrincipal } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PrismaService } from "../../prisma/prisma.service";

const APPLICATION_STAGES = ["applied", "screening", "interview", "offer", "hired", "rejected"] as const;

class CreateJobDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  titleEn: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  titleKm: string;

  @IsString()
  @MaxLength(10000)
  description: string;
}

class ApplyCandidateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName: string;

  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string;
}

class MoveApplicationDto {
  @IsIn([...APPLICATION_STAGES])
  stage: (typeof APPLICATION_STAGES)[number];
}

class UpdateJobStatusDto {
  @IsIn(["open", "closed"])
  status: "open" | "closed";
}

@Controller("recruitment")
@UseGuards(PermissionsGuard)
class RecruitmentController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  @Get("jobs")
  @RequirePermissions("recruitment.write")
  jobs(@CurrentUser() user: AuthPrincipal) {
    return this.prisma.jobRequisition.findMany({
      where: { tenantId: user.tenantId },
      include: {
        applications: {
          where: { candidate: { tenantId: user.tenantId } },
          include: { candidate: true },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  @Post("jobs")
  @RequirePermissions("recruitment.write")
  createJob(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateJobDto) {
    return this.prisma.jobRequisition.create({
      data: {
        titleEn: dto.titleEn.trim(),
        titleKm: dto.titleKm.trim(),
        description: dto.description.trim(),
        tenantId: user.tenantId,
      },
    });
  }

  @Patch("jobs/:id/status")
  @RequirePermissions("recruitment.write")
  async updateJobStatus(
    @CurrentUser() user: AuthPrincipal,
    @Param("id") id: string,
    @Body() dto: UpdateJobStatusDto,
  ) {
    const result = await this.prisma.jobRequisition.updateMany({
      where: { id, tenantId: user.tenantId },
      data: { status: dto.status },
    });
    if (!result.count) throw new NotFoundException("Job requisition not found");
    return this.prisma.jobRequisition.findFirstOrThrow({ where: { id, tenantId: user.tenantId } });
  }

  @Post("jobs/:jobId/applications")
  @RequirePermissions("recruitment.write")
  async apply(
    @CurrentUser() user: AuthPrincipal,
    @Param("jobId") jobId: string,
    @Body() dto: ApplyCandidateDto,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const job = await tx.jobRequisition.findFirst({
        where: { id: jobId, tenantId: user.tenantId },
        select: { id: true, status: true },
      });
      if (!job) throw new NotFoundException("Job requisition not found");
      if (job.status !== "open") throw new BadRequestException("This job requisition is closed");

      const email = dto.email.trim().toLowerCase();
      let candidate = await tx.candidate.findFirst({
        where: { tenantId: user.tenantId, email },
      });
      if (!candidate) {
        candidate = await tx.candidate.create({
          data: {
            tenantId: user.tenantId,
            fullName: dto.fullName.trim(),
            email,
            phone: dto.phone?.trim() || null,
            source: dto.source?.trim() || null,
          },
        });
      } else {
        candidate = await tx.candidate.update({
          where: { id: candidate.id },
          data: {
            fullName: dto.fullName.trim(),
            ...(dto.phone !== undefined ? { phone: dto.phone.trim() || null } : {}),
          },
        });
      }

      const existing = await tx.application.findFirst({
        where: { jobId: job.id, candidateId: candidate.id },
        select: { id: true },
      });
      if (existing) throw new ConflictException("Candidate already applied for this job");
      const application = await tx.application.create({
        data: { jobId: job.id, candidateId: candidate.id },
        include: { candidate: true },
      });
      return { tenantId: user.tenantId, ...application };
    });
    this.events.emit(EVENTS.APPLICATION_CREATED, result);
    return result;
  }

  @Patch("applications/:id/stage")
  @RequirePermissions("recruitment.write")
  async move(
    @CurrentUser() user: AuthPrincipal,
    @Param("id") id: string,
    @Body() dto: MoveApplicationDto,
  ) {
    const result = await this.prisma.application.updateMany({
      where: { id, job: { tenantId: user.tenantId }, candidate: { tenantId: user.tenantId } },
      data: { stage: dto.stage },
    });
    if (!result.count) throw new NotFoundException("Application not found");
    const row = await this.prisma.application.findFirstOrThrow({
      where: { id, job: { tenantId: user.tenantId }, candidate: { tenantId: user.tenantId } },
      include: { candidate: true, job: true },
    });
    this.events.emit(EVENTS.APPLICATION_MOVED, { tenantId: user.tenantId, ...row });
    return row;
  }
}

@Module({ controllers: [RecruitmentController] })
export class RecruitmentModule {}
