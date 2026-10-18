import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsInt, IsNumber, IsOptional, Max, Min } from "class-validator";
import { CurrentUser, type AuthPrincipal } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PayrollService } from "./payroll.service";

class PeriodDto {
  @IsInt()
  @Min(2020)
  year: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(100000)
  fxUsdKhr?: number;
}

@ApiTags("payroll")
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller("payroll")
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @Get("runs")
  @RequirePermissions("payroll.read")
  listRuns(@CurrentUser() user: AuthPrincipal) {
    return this.payroll.listRuns(user.tenantId);
  }

  @Get("runs/:id")
  @RequirePermissions("payroll.read")
  getRun(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) {
    return this.payroll.getRun(user.tenantId, id);
  }

  @Post("runs/:id/void")
  @RequirePermissions("payroll.run")
  voidRun(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) {
    return this.payroll.voidRun(user.tenantId, id);
  }

  @Post("runs")
  @RequirePermissions("payroll.run")
  calculate(@CurrentUser() user: AuthPrincipal, @Body() dto: PeriodDto) {
    return this.payroll.calculate(user.tenantId, dto.year, dto.month, user.userId, dto.fxUsdKhr);
  }

  @Post("runs/:id/approve")
  @RequirePermissions("payroll.approve")
  approve(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) {
    return this.payroll.approve(user.tenantId, id, user.userId);
  }

  @Post("runs/:id/variance-approval")
  @RequirePermissions("payroll.approve")
  varianceApproval(
    @CurrentUser() user: AuthPrincipal,
    @Param("id") id: string,
    @Body() dto: { justification: string },
  ) {
    return this.payroll.varianceApproval(user.tenantId, id, user.userId, dto.justification);
  }

  @Post("runs/:id/pay")
  @RequirePermissions("payroll.approve")
  pay(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) {
    return this.payroll.markPaid(user.tenantId, id);
  }
}
