import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { EventEmitter2 } from "@nestjs/event-emitter";
import PDFDocument from "pdfkit";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { EVENTS } from "@krompay/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { S3StorageService } from "../../storage/s3-storage.service";

@Processor("payslips")
export class PayslipProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly storage: S3StorageService,
  ) {
    super();
  }

  async process(job: Job<{ tenantId: string; runId: string }>) {
    return this.prisma.runAsTenant(job.data.tenantId, () => this.processTenant(job));
  }

  private async processTenant(job: Job<{ tenantId: string; runId: string }>) {
    const items = await this.prisma.payrollItem.findMany({
      where: { runId: job.data.runId, run: { tenantId: job.data.tenantId } },
      include: { employee: true, run: { include: { period: true } } },
    });
    for (const item of items) {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ size: "A4", margin: 48 });
      const khmerFont = resolve(__dirname, "../../../assets/fonts/Khmer.ttf");
      if (!existsSync(khmerFont)) throw new Error("Payslip font asset is missing");
      doc.font(khmerFont);
      doc.on("data", (c) => chunks.push(c as Buffer));
      const completed = new Promise<void>((resolve, reject) => {
        doc.once("end", resolve);
        doc.once("error", reject);
      });
      const name = `${item.employee.lastNameEn} ${item.employee.firstNameEn}`;
      const breakdown = item.breakdown as { familyRelief?: number };
      doc.fontSize(18).text("KromPay Payslip / សន្លឹកប្រាក់ខែ", { align: "center" });
      doc.moveDown();
      doc.fontSize(11).text(`Employee / បុគ្គលិក: ${name} (${item.employee.employeeNo})`);
      doc.text(`Period / ប្រចាំខែ: ${item.run.period.year}-${String(item.run.period.month).padStart(2, "0")}`);
      doc.moveDown();
      doc.text(`Basic salary / ប្រាក់ខែគោល: ${item.basic} KHR`);
      doc.text(`Allowances / ប្រាក់ឧបត្ថម្ភ: ${item.allowances} KHR`);
      doc.text(`Overtime / ម៉ោងបន្ថែម: ${item.overtime} KHR`);
      doc.text(`Unpaid leave / ច្បាប់គ្មានប្រាក់ខែ: ${item.unpaidLeave} KHR`);
      doc.text(`Gross / ប្រាក់ខែសរុប: ${item.gross} KHR`);
      doc.text(`Family relief / ការកាត់បន្ថយគ្រួសារ: ${breakdown.familyRelief ?? 0} KHR`);
      doc.text(`Tax on Salary / ពន្ធលើប្រាក់ខែ: ${item.tosAmount} KHR`);
      doc.text(`NSSF pension (employee) / ប្រាក់សោធននិវត្តន៍: ${item.nssfPensionEe} KHR`);
      doc.text(`NSSF employer / NSSF និយោជក: ${Number(item.nssfPensionEr) + Number(item.nssfHealthEr) + Number(item.nssfRiskEr)} KHR`);
      doc.text(`Other deductions / ការកាត់ផ្សេងៗ: ${item.otherDeductions} KHR`);
      doc.moveDown();
      doc.fontSize(14).text(`Net pay / ប្រាក់ខែសុទ្ធ: ${item.net} KHR`);
      doc.end();
      await completed;
      const pdf = Buffer.concat(chunks);
      const key = `tenants/${job.data.tenantId}/payslips/${job.data.runId}/${item.employeeId}.pdf`;
      await this.storage.putObject(key, pdf, "application/pdf");
      const existing = await this.prisma.storedFile.findFirst({
        where: { tenantId: job.data.tenantId, bucket: this.storage.defaultBucket, key },
      });
      const file = existing
        ? await this.prisma.storedFile.update({
            where: { id: existing.id },
            data: { mimeType: "application/pdf", sizeBytes: pdf.length },
          })
        : await this.prisma.storedFile.create({
            data: {
              tenantId: job.data.tenantId,
              bucket: this.storage.defaultBucket,
              key,
              mimeType: "application/pdf",
              sizeBytes: pdf.length,
            },
          });
      await this.prisma.payrollItem.update({
        where: { id: item.id },
        data: { payslipFileId: file.id },
      });
      await this.prisma.payslip.upsert({
        where: { itemId: item.id },
        update: { fileId: file.id },
        create: { itemId: item.id, fileId: file.id },
      });
      this.events.emit(EVENTS.PAYSLIP_GENERATED, {
        tenantId: job.data.tenantId,
        employeeId: item.employeeId,
        fileId: file.id,
      });
    }
  }
}
