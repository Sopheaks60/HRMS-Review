import { Module } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { EVENTS } from "@krompay/shared";
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from "class-validator";
import { CurrentUser, type AuthPrincipal } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PrismaService } from "../../prisma/prisma.service";

class CreateLeaveDto {
  @IsUUID()
  leaveTypeId: string;
  @IsDateString()
  startDate: string;
  @IsDateString()
  endDate: string;
  @IsOptional()
  @IsString()
  reason?: string;
}

class DecideLeaveDto {
  @IsEnum(["APPROVED", "REJECTED"])
  status: "APPROVED" | "REJECTED";
}

@Controller("leave")
@UseGuards(PermissionsGuard)
export class LeaveController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  @Get()
  @RequirePermissions("leave.read")
  list(@CurrentUser() user: AuthPrincipal) {
    return this.prisma.leaveRequest.findMany({
      where: {
        tenantId: user.tenantId,
        ...(user.permissions.includes("leave.approve") ? {} : { employeeId: user.employeeId ?? "" }),
      },
      include: {
        leaveType: true,
        employee: { select: { employeeNo: true, firstNameEn: true, lastNameEn: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  @Get("types")
  types(@CurrentUser() user: AuthPrincipal) {
    return this.prisma.leaveType.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { code: "asc" },
    });
  }

  @Get("balances/me")
  balances(@CurrentUser() user: AuthPrincipal) {
    if (!user.employeeId) throw new ForbiddenException("User is not linked to an employee");
    return this.prisma.leaveBalance.findMany({
      where: { employeeId: user.employeeId, year: new Date().getFullYear() },
    });
  }

  @Post()
  @RequirePermissions("leave.apply")
  async create(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateLeaveDto) {
    if (!user.employeeId) throw new ForbiddenException("User is not linked to an employee");
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) {
      throw new BadRequestException("Leave dates are invalid");
    }
    if (start.getUTCFullYear() !== end.getUTCFullYear()) {
      throw new BadRequestException("A leave request cannot cross calendar years");
    }
    const days = Math.floor((Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()) -
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())) / 86400000) + 1;
    const leaveType = await this.prisma.leaveType.findFirst({
      where: { id: dto.leaveTypeId, tenantId: user.tenantId },
    });
    if (!leaveType) throw new NotFoundException("Leave type not found");
    const year = start.getUTCFullYear();
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${user.employeeId!}), hashtext('leave-request'))`;
      const overlaps = await tx.leaveRequest.findFirst({
        where: {
          tenantId: user.tenantId,
          employeeId: user.employeeId!,
          status: { in: ["SUBMITTED", "APPROVED"] },
          startDate: { lte: end },
          endDate: { gte: start },
        },
      });
      if (overlaps) throw new BadRequestException("Leave dates overlap an existing request");
      if (leaveType.paid) {
        const balance = await tx.leaveBalance.findUnique({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: user.employeeId!,
              leaveTypeId: leaveType.id,
              year,
            },
          },
        });
        const entitled = Number(balance?.entitled ?? leaveType.annualQuotaDays);
        const used = Number(balance?.used ?? 0);
        const pending = Number(balance?.pending ?? 0);
        if (used + pending + days > entitled) {
          throw new BadRequestException("Insufficient leave balance");
        }
        await tx.leaveBalance.upsert({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: user.employeeId!,
              leaveTypeId: leaveType.id,
              year,
            },
          },
          update: { pending: { increment: days } },
          create: {
            employeeId: user.employeeId!,
            leaveTypeId: leaveType.id,
            year,
            entitled: leaveType.annualQuotaDays,
            pending: days,
          },
        });
      }
      return tx.leaveRequest.create({
        data: {
          tenantId: user.tenantId,
          employeeId: user.employeeId!,
          leaveTypeId: leaveType.id,
          startDate: start,
          endDate: end,
          days,
          reason: dto.reason,
        },
        include: { leaveType: true },
      });
    });
    this.events.emit(EVENTS.LEAVE_SUBMITTED, row);
    return row;
  }

  @Patch(":id/decide")
  @RequirePermissions("leave.approve")
  async decide(
    @CurrentUser() user: AuthPrincipal,
    @Param("id") id: string,
    @Body() body: DecideLeaveDto,
  ) {
    const row = await this.prisma.$transaction(async (tx) => {
      const request = await tx.leaveRequest.findFirst({
        where: { id, tenantId: user.tenantId },
        include: { leaveType: true },
      });
      if (!request) throw new NotFoundException();
      if (request.status !== "SUBMITTED") throw new BadRequestException("Leave request is no longer pending");
      const updated = await tx.leaveRequest.updateMany({
        where: { id, tenantId: user.tenantId, status: "SUBMITTED" },
        data: { status: body.status, approverId: user.userId, decidedAt: new Date() },
      });
      if (!updated.count) throw new BadRequestException("Leave request was already decided");
      if (request.leaveType.paid) {
        const year = request.startDate.getUTCFullYear();
        await tx.leaveBalance.updateMany({
          where: { employeeId: request.employeeId, leaveTypeId: request.leaveTypeId, year },
          data: {
            pending: { decrement: Number(request.days) },
            ...(body.status === "APPROVED" ? { used: { increment: Number(request.days) } } : {}),
          },
        });
      }
      return tx.leaveRequest.findFirstOrThrow({ where: { id, tenantId: user.tenantId } });
    });
    this.events.emit(EVENTS.LEAVE_DECIDED, row);
    return row;
  }
}

@Module({ controllers: [LeaveController] })
export class LeaveModule {}
