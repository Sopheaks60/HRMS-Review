import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { BankExportService } from "./bank-export.service";
import { GdtExportService } from "./gdt-export.service";
import { PayrollExportController } from "./payroll-export.controller";
import { PayrollController } from "./payroll.controller";
import { PayrollService } from "./payroll.service";
import { PayslipProcessor } from "./payslip.processor";

@Module({
  imports: [BullModule.registerQueue({ name: "payslips" })],
  controllers: [PayrollController, PayrollExportController],
  providers: [PayrollService, PayslipProcessor, BankExportService, GdtExportService],
  exports: [PayrollService, BankExportService, GdtExportService],
})
export class PayrollModule {}

