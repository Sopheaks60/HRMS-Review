import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { CurrentUser, type AuthPrincipal } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PrismaService } from "../../prisma/prisma.service";

class CreateCourseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  titleEn: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  titleKm: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  durationH: number;
}

class ProgressDto {
  @IsInt()
  @Min(0)
  @Max(100)
  progress: number;
}

@Controller("lms")
@UseGuards(PermissionsGuard)
class LmsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("courses")
  courses(@CurrentUser() user: AuthPrincipal) {
    return this.prisma.course.findMany({
      where: { tenantId: user.tenantId },
      include: {
        enrollments: user.permissions.includes("lms.write")
          ? { select: { id: true, progress: true, completedAt: true } }
          : {
              where: { employeeId: user.employeeId ?? "" },
              select: { id: true, progress: true, completedAt: true },
            },
      },
      orderBy: { titleEn: "asc" },
    });
  }

  @Post("courses")
  @RequirePermissions("lms.write")
  create(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateCourseDto) {
    return this.prisma.course.create({
      data: {
        titleEn: dto.titleEn.trim(),
        titleKm: dto.titleKm.trim(),
        description: dto.description?.trim() || null,
        durationH: dto.durationH,
        tenantId: user.tenantId,
      },
    });
  }

  @Post("courses/:courseId/enroll")
  async enroll(@CurrentUser() user: AuthPrincipal, @Param("courseId") courseId: string) {
    if (!user.employeeId) throw new ForbiddenException("User is not linked to an employee");
    return this.prisma.$transaction(async (tx) => {
      const course = await tx.course.findFirst({
        where: { id: courseId, tenantId: user.tenantId },
        select: { id: true },
      });
      if (!course) throw new NotFoundException("Course not found");

      const employee = await tx.employee.findFirst({
        where: { id: user.employeeId, tenantId: user.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!employee) throw new NotFoundException("Employee not found");

      return tx.courseEnrollment.upsert({
        where: { courseId_employeeId: { courseId: course.id, employeeId: employee.id } },
        create: { courseId: course.id, employeeId: employee.id },
        update: {},
      });
    });
  }

  @Get("courses/:courseId/enrollments")
  @RequirePermissions("lms.write")
  async enrollments(@CurrentUser() user: AuthPrincipal, @Param("courseId") courseId: string) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!course) throw new NotFoundException("Course not found");
    return this.prisma.courseEnrollment.findMany({
      where: { courseId: course.id, employee: { tenantId: user.tenantId } },
      include: {
        employee: {
          select: { id: true, employeeNo: true, firstNameEn: true, lastNameEn: true },
        },
      },
      orderBy: [{ completedAt: "asc" }, { employee: { employeeNo: "asc" } }],
    });
  }

  @Patch("enrollments/:id/progress")
  async updateProgress(
    @CurrentUser() user: AuthPrincipal,
    @Param("id") id: string,
    @Body() dto: ProgressDto,
  ) {
    const manager = user.permissions.includes("lms.write");
    if (!manager && !user.employeeId) throw new ForbiddenException("User is not linked to an employee");

    const where = {
      id,
      course: { tenantId: user.tenantId },
      ...(manager ? {} : { employeeId: user.employeeId }),
    };
    const enrollment = await this.prisma.courseEnrollment.findFirst({ where });
    if (!enrollment) throw new NotFoundException("Course enrollment not found");
    if (dto.progress < enrollment.progress) {
      throw new BadRequestException("Course progress cannot move backwards");
    }
    if (dto.progress === enrollment.progress) return enrollment;

    const result = await this.prisma.courseEnrollment.updateMany({
      where: { ...where, progress: enrollment.progress },
      data: {
        progress: dto.progress,
        completedAt: dto.progress === 100 ? new Date() : null,
      },
    });
    if (!result.count) throw new ConflictException("Course progress changed; refresh and try again");
    return this.prisma.courseEnrollment.findFirstOrThrow({ where });
  }
}

@Module({ controllers: [LmsController] })
export class LmsModule {}
