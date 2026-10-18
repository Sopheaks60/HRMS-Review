import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class GdtExportService {
  constructor(private readonly prisma: PrismaService) {}

  async generateGdtXml(tenantId: string, runId: string): Promise<string> {
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
                taxResidency: true,
                dependents: { where: { qualifiesTos: true } },
              },
            },
          },
          orderBy: { employee: { employeeNo: "asc" } },
        },
      },
    });

    if (!run) throw new NotFoundException("Payroll run not found");
    if (run.status !== "APPROVED" && run.status !== "PAID") {
      throw new BadRequestException("GDT declaration is only available for APPROVED or PAID payroll runs");
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });

    const residents = run.items.filter((item) => item.employee.taxResidency === "RESIDENT");
    const nonResidents = run.items.filter((item) => item.employee.taxResidency === "NON_RESIDENT");

    const residentXml = residents
      .map((item, idx) => {
        const emp = item.employee;
        const name = `${emp.firstNameEn} ${emp.lastNameEn}`;
        const relief = Math.round(Number(item.gross) - Number(item.tosBase));
        return `    <Employee seq="${idx + 1}" employeeNo="${emp.employeeNo}" name="${name}" gross="${Math.round(Number(item.gross))}" familyRelief="${relief}" taxableBase="${Math.round(Number(item.tosBase))}" tosAmount="${Math.round(Number(item.tosAmount))}" />`;
      })
      .join("\n");

    const nonResidentXml = nonResidents
      .map((item, idx) => {
        const emp = item.employee;
        const name = `${emp.firstNameEn} ${emp.lastNameEn}`;
        return `    <Employee seq="${idx + 1}" employeeNo="${emp.employeeNo}" name="${name}" gross="${Math.round(Number(item.gross))}" rateFlat="0.20" tosAmount="${Math.round(Number(item.tosAmount))}" />`;
      })
      .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<GDT_TOS_Declaration
  xmlns="urn:kh:gdt:tos:2024"
  month="${run.period.month}"
  year="${run.period.year}"
  taxId="${tenant?.taxId ?? ""}"
  entityName="${tenant?.legalName ?? tenant?.name ?? "KromPay Client"}"
  totalGross="${Math.round(Number(run.totalGross))}"
  totalTos="${Math.round(Number(run.totalTos))}"
  currency="KHR"
  generatedAt="${new Date().toISOString()}">
  <Schedule01 description="Tax on Salary - Resident Employees" count="${residents.length}">
${residentXml}
  </Schedule01>
  <Schedule02 description="Tax on Salary - Non-Resident Withholding" count="${nonResidents.length}">
${nonResidentXml}
  </Schedule02>
</GDT_TOS_Declaration>`;
  }

  async generateNssfSchedule(tenantId: string, runId: string): Promise<string> {
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
                nssfNumber: true,
              },
            },
          },
          orderBy: { employee: { employeeNo: "asc" } },
        },
      },
    });

    if (!run) throw new NotFoundException("Payroll run not found");
    if (run.status !== "APPROVED" && run.status !== "PAID") {
      throw new BadRequestException("NSSF schedule is only available for APPROVED or PAID payroll runs");
    }

    const headers = [
      "employee_no",
      "employee_name",
      "nssf_id",
      "gross_khr",
      "contributory_wage",
      "pension_ee",
      "pension_er",
      "health_er",
      "risk_er",
      "total_ee",
      "total_er",
    ];

    const rows = run.items.map((item) => {
      const emp = item.employee;
      const name = `"${emp.firstNameEn} ${emp.lastNameEn}"`;
      const pensionEe = Math.round(Number(item.nssfPensionEe));
      const pensionEr = Math.round(Number(item.nssfPensionEr));
      const healthEr = Math.round(Number(item.nssfHealthEr));
      const riskEr = Math.round(Number(item.nssfRiskEr));
      const totalEe = pensionEe;
      const totalEr = pensionEr + healthEr + riskEr;

      return [
        emp.employeeNo,
        name,
        emp.nssfNumber ?? "PENDING",
        Math.round(Number(item.gross)),
        Math.round(Number(item.nssfWage)),
        pensionEe,
        pensionEr,
        healthEr,
        riskEr,
        totalEe,
        totalEr,
      ].join(",");
    });

    return "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
  }
}

