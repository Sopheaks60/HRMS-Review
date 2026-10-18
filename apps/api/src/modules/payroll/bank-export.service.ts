import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class BankExportService {
  constructor(private readonly prisma: PrismaService) {}

  async generateAbaBatch(tenantId: string, runId: string): Promise<string> {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, tenantId },
      include: {
        period: true,
        items: {
          include: {
            employee: {
              select: {
                id: true,
                employeeNo: true,
                firstNameEn: true,
                lastNameEn: true,
                bankAccountEnc: true,
                bankName: true,
              },
            },
          },
          orderBy: { employee: { employeeNo: "asc" } },
        },
      },
    });

    if (!run) throw new NotFoundException("Payroll run not found");
    if (run.status !== "APPROVED" && run.status !== "PAID") {
      throw new BadRequestException("Bank export is only available for APPROVED or PAID payroll runs");
    }

    const headers = ["account_no", "amount_khr", "amount_usd", "employee_name_en", "reference", "bank_code"];
    const rows = run.items.map((item) => {
      const emp = item.employee;
      const ref = `KP-${run.period.year}${String(run.period.month).padStart(2, "0")}-${emp.employeeNo}`;
      const name = `"${emp.firstNameEn} ${emp.lastNameEn}"`;
      const netKhr = Math.round(Number(item.net));
      const fx = Number(run.fxUsdKhr) || 4100;
      const netUsd = (netKhr / fx).toFixed(2);
      const acc = emp.bankAccountEnc ? "[ENCRYPTED_ACCOUNT]" : "000000000";
      const bank = emp.bankName ?? "ABA";
      return [acc, netKhr, netUsd, name, ref, bank].join(",");
    });

    // UTF-8 BOM (\uFEFF) for Microsoft Excel compatibility with international characters
    return "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
  }

  async generateCanadiaFlatFile(tenantId: string, runId: string): Promise<string> {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, tenantId },
      include: {
        period: true,
        items: {
          include: {
            employee: {
              select: {
                employeeNo: true,
                firstNameEn: true,
                lastNameEn: true,
                bankAccountEnc: true,
              },
            },
          },
          orderBy: { employee: { employeeNo: "asc" } },
        },
      },
    });

    if (!run) throw new NotFoundException("Payroll run not found");
    if (run.status !== "APPROVED" && run.status !== "PAID") {
      throw new BadRequestException("Bank export is only available for APPROVED or PAID payroll runs");
    }

    // Pipe-delimited flat file for Canadia Bank batch payroll interface
    const lines = run.items.map((item) => {
      const emp = item.employee;
      const ref = `KP${run.period.year}${String(run.period.month).padStart(2, "0")}${emp.employeeNo}`;
      const netKhr = Math.round(Number(item.net));
      const acc = emp.bankAccountEnc ? "[ENCRYPTED_ACCOUNT]" : "000000000";
      return [emp.employeeNo, acc, netKhr, "KHR", ref, "001"].join("|");
    });

    return lines.join("\r\n");
  }
}

