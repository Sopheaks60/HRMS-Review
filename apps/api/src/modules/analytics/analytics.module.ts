import { Controller, Get, UseGuards, Module } from "@nestjs/common";
import { CurrentUser, type AuthPrincipal } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PrismaService } from "../../prisma/prisma.service";

@Controller("analytics")
@UseGuards(PermissionsGuard)
class AnalyticsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("dashboard")
  @RequirePermissions("dashboard.read")
  async dashboard(@CurrentUser() user: AuthPrincipal) {
    const [headcount, pendingLeave, lastRun] = await Promise.all([
      this.prisma.employee.count({
        where: { tenantId: user.tenantId, status: { in: ["ACTIVE", "PROBATION"] } },
      }),
      this.prisma.leaveRequest.count({
        where: { tenantId: user.tenantId, status: "SUBMITTED" },
      }),
      this.prisma.payrollRun.findFirst({
        where: { tenantId: user.tenantId },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return {
      headcount,
      pendingLeave,
      lastPayroll: lastRun,
      currency: "KHR",
    };
  }
}

@Module({ controllers: [AnalyticsController] })
export class AnalyticsModule {}
