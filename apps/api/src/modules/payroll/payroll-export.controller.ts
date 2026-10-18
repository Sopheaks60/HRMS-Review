import { Controller, Get, Param, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { CurrentUser, type AuthPrincipal } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { BankExportService } from "./bank-export.service";
import { GdtExportService } from "./gdt-export.service";

@ApiTags("payroll-exports")
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller("payroll/runs")
export class PayrollExportController {
  constructor(
    private readonly bankExport: BankExportService,
    private readonly gdtExport: GdtExportService,
  ) {}

  @Get(":id/export/aba")
  @RequirePermissions("payroll.read")
  async exportAba(
    @CurrentUser() user: AuthPrincipal,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const csv = await this.bankExport.generateAbaBatch(user.tenantId, id);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=aba-payway-${id}.csv`);
    return res.send(csv);
  }

  @Get(":id/export/canadia")
  @RequirePermissions("payroll.read")
  async exportCanadia(
    @CurrentUser() user: AuthPrincipal,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const txt = await this.bankExport.generateCanadiaFlatFile(user.tenantId, id);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=canadia-payroll-${id}.txt`);
    return res.send(txt);
  }

  @Get(":id/export/gdt-xml")
  @RequirePermissions("payroll.read")
  async exportGdtXml(
    @CurrentUser() user: AuthPrincipal,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const xml = await this.gdtExport.generateGdtXml(user.tenantId, id);
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=gdt-tos-${id}.xml`);
    return res.send(xml);
  }

  @Get(":id/export/nssf-csv")
  @RequirePermissions("payroll.read")
  async exportNssfCsv(
    @CurrentUser() user: AuthPrincipal,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const csv = await this.gdtExport.generateNssfSchedule(user.tenantId, id);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=nssf-schedule-${id}.csv`);
    return res.send(csv);
  }
}

