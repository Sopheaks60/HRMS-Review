import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, Patch, Post, UseGuards, Module } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { EVENTS } from "@krompay/shared";
import { IsDateString, IsEnum, IsNumber, IsString, Max, Min } from "class-validator";
import { CurrentUser, type AuthPrincipal } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PrismaService } from "../../prisma/prisma.service";

class OtDto {
  @IsDateString()
  workDate: string;
  @IsNumber()
  @Min(0.25)
  @Max(12)
  hours: number;
  @IsEnum(["weekday", "night", "rest", "holiday"])
  @IsString()
  otType: string;
  @IsString()
  reason: string;
}

class DecideOtDto {
  @IsEnum(["APPROVED", "REJECTED"])
  status: "APPROVED" | "REJECTED";
}

@Controller("overtime")
@UseGuards(PermissionsGuard)
class OvertimeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  @Get()
  @RequirePermissions("leave.read")
  list(@CurrentUser() user: AuthPrincipal) {
    return this.prisma.overtimeRequest.findMany({
      where: {
        tenantId: user.tenantId,
        ...(user.permissions.includes("overtime.approve") ? {} : { employeeId: user.employeeId ?? "" }),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  @Post()
  async create(@CurrentUser() user: AuthPrincipal, @Body() dto: OtDto) {
    if (!user.employeeId) throw new ForbiddenException("User is not linked to an employee");
    const workDate = new Date(dto.workDate);
    if (!Number.isFinite(workDate.getTime())) throw new BadRequestException("Invalid work date");
    const monthStart = new Date(Date.UTC(workDate.getUTCFullYear(), workDate.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(workDate.getUTCFullYear(), workDate.getUTCMonth() + 1, 0));
    const [policy, requests] = await Promise.all([
      this.prisma.overtimePolicy.findFirst({ where: { tenantId: user.tenantId } }),
      this.prisma.overtimeRequest.findMany({
        where: {
          tenantId: user.tenantId,
          employeeId: user.employeeId,
          status: { in: ["SUBMITTED", "APPROVED"] },
          workDate: { gte: monthStart, lte: monthEnd },
        },
        select: { hours: true },
      }),
    ]);
    const cap = Number(policy?.maxHoursMonth ?? 54);
    const monthHours = requests.reduce((sum, request) => sum + Number(request.hours), 0);
    if (monthHours + dto.hours > cap) {
      throw new BadRequestException(`Monthly overtime limit is ${cap} hours`);
    }
    const row = await this.prisma.overtimeRequest.create({
      data: {
        tenantId: user.tenantId,
        employeeId: user.employeeId,
        workDate,
        hours: dto.hours,
        otType: dto.otType,
        reason: dto.reason,
      },
    });
    return row;
  }

  @Patch(":id/decide")
  @RequirePermissions("overtime.approve")
  async decide(
    @CurrentUser() user: AuthPrincipal,
    @Param("id") id: string,
    @Body() body: DecideOtDto,
  ) {
    const result = await this.prisma.overtimeRequest.updateMany({
      where: { id, tenantId: user.tenantId, status: "SUBMITTED" },
      data: { status: body.status, approverId: user.userId },
    });
    if (!result.count) {
      const exists = await this.prisma.overtimeRequest.findFirst({ where: { id, tenantId: user.tenantId } });
      if (!exists) throw new NotFoundException();
      throw new BadRequestException("Overtime request is no longer pending");
    }
    const row = await this.prisma.overtimeRequest.findFirstOrThrow({ where: { id, tenantId: user.tenantId } });
    this.events.emit(EVENTS.OVERTIME_DECIDED, row);
    return row;
  }
}

@Module({ controllers: [OvertimeController] })
export class OvertimeModule {}
