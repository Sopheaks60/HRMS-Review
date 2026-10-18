import {
  BadRequestException,
  Body,
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
import { IsDateString, IsNumber, IsString, IsUUID, Max, Min, MaxLength, MinLength } from "class-validator";
import { calculateKpiScore } from "@krompay/shared";
import { CurrentUser, type AuthPrincipal } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PrismaService } from "../../prisma/prisma.service";

class CreateCycleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}

class CreateAssignmentDto {
  @IsUUID()
  employeeId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  target: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  weight: number;
}

class UpdateActualDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  actual: number;
}

@Controller("performance")
@UseGuards(PermissionsGuard)
class PerformanceController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("cycles")
  @RequirePermissions("kpi.write")
  cycles(@CurrentUser() user: AuthPrincipal) {
    return this.prisma.kpiCycle.findMany({
      where: { tenantId: user.tenantId },
      include: {
        assignments: {
          include: {
            employee: {
              select: { id: true, employeeNo: true, firstNameEn: true, lastNameEn: true },
            },
          },
          orderBy: { title: "asc" },
        },
      },
      orderBy: { startDate: "desc" },
    });
  }

  @Get("me")
  async mine(@CurrentUser() user: AuthPrincipal) {
    if (!user.employeeId) throw new ForbiddenException("User is not linked to an employee");
    return this.prisma.kpiAssignment.findMany({
      where: { employeeId: user.employeeId, cycle: { tenantId: user.tenantId } },
      include: { cycle: { select: { id: true, name: true, startDate: true, endDate: true, status: true } } },
      orderBy: { cycle: { startDate: "desc" } },
    });
  }

  @Post("cycles")
  @RequirePermissions("kpi.write")
  create(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateCycleDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (startDate > endDate) throw new BadRequestException("Cycle start must be before its end");
    return this.prisma.kpiCycle.create({
      data: { tenantId: user.tenantId, name: dto.name.trim(), startDate, endDate },
    });
  }

  @Post("cycles/:cycleId/assignments")
  @RequirePermissions("kpi.write")
  async assign(
    @CurrentUser() user: AuthPrincipal,
    @Param("cycleId") cycleId: string,
    @Body() dto: CreateAssignmentDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const cycle = await tx.kpiCycle.findFirst({
        where: { id: cycleId, tenantId: user.tenantId },
      });
      if (!cycle) throw new NotFoundException("KPI cycle not found");
      if (cycle.status !== "active") throw new BadRequestException("KPI cycle is not active");

      const employee = await tx.employee.findFirst({
        where: { id: dto.employeeId, tenantId: user.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!employee) throw new NotFoundException("Employee not found");

      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${cycleId}), hashtext(${employee.id}))`;

      const duplicate = await tx.kpiAssignment.findFirst({
        where: { cycleId, employeeId: employee.id, title: dto.title.trim() },
        select: { id: true },
      });
      if (duplicate) throw new BadRequestException("This KPI is already assigned to the employee");

      const currentWeights = await tx.kpiAssignment.aggregate({
        where: { cycleId, employeeId: employee.id },
        _sum: { weight: true },
      });
      const existingWeight = Number(currentWeights._sum.weight ?? 0);
      if (existingWeight + dto.weight > 100.0001) {
        throw new BadRequestException("An employee's KPI weights cannot exceed 100%");
      }

      return tx.kpiAssignment.create({
        data: {
          cycleId,
          employeeId: employee.id,
          title: dto.title.trim(),
          target: dto.target,
          weight: dto.weight,
        },
      });
    });
  }

  @Patch("assignments/:id/actual")
  async updateActual(
    @CurrentUser() user: AuthPrincipal,
    @Param("id") id: string,
    @Body() dto: UpdateActualDto,
  ) {
    if (!user.employeeId && !user.permissions.includes("kpi.write")) {
      throw new ForbiddenException("User is not linked to an employee");
    }
    const where = {
      id,
      cycle: { tenantId: user.tenantId, status: "active" },
      ...(user.permissions.includes("kpi.write") ? {} : { employeeId: user.employeeId }),
    };
    const assignment = await this.prisma.kpiAssignment.findFirst({ where });
    if (!assignment) throw new NotFoundException("Active KPI assignment not found");

    const score = calculateKpiScore(dto.actual, Number(assignment.target));
    const result = await this.prisma.kpiAssignment.updateMany({
      where,
      data: { actual: dto.actual, score },
    });
    if (!result.count) throw new NotFoundException("Active KPI assignment not found");
    return this.prisma.kpiAssignment.findFirstOrThrow({ where });
  }
}

@Module({ controllers: [PerformanceController] })
export class PerformanceModule {}
