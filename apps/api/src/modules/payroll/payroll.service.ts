import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { Prisma } from "@prisma/client";
import {
  CAMBODIA_2026,
  EVENTS,
  calculatePayroll,
  isCambodiaStatutoryConfig,
  overtimePay,
} from "@krompay/shared";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    @InjectQueue("payslips") private readonly payslips: Queue,
  ) {}

  listRuns(tenantId: string) {
    return this.prisma.payrollRun.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        status: true,
        fxUsdKhr: true,
        totalGross: true,
        totalNet: true,
        totalTos: true,
        totalNssfEe: true,
        totalNssfEr: true,
        createdAt: true,
        approvedAt: true,
        paidAt: true,
        period: { select: { year: true, month: true, startDate: true, endDate: true } },
        _count: { select: { items: true } },
      },
    });
  }

  async getRun(tenantId: string, runId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, tenantId },
      include: {
        period: true,
        items: {
          include: { employee: { select: { id: true, employeeNo: true, firstNameEn: true, lastNameEn: true } } },
          orderBy: { employee: { employeeNo: "asc" } },
        },
      },
    });
    if (!run) throw new NotFoundException("Payroll run not found");
    return run;
  }

  async calculate(tenantId: string, year: number, month: number, actorId: string, fxUsdKhr?: number) {
    if (fxUsdKhr !== undefined && (!Number.isFinite(fxUsdKhr) || fxUsdKhr < 1000 || fxUsdKhr > 100000)) {
      throw new BadRequestException("USD to KHR exchange rate must be between 1,000 and 100,000");
    }
    const period = await this.prisma.payrollPeriod.upsert({
      where: { tenantId_year_month: { tenantId, year, month } },
      update: {},
      create: {
        tenantId,
        year,
        month,
        startDate: new Date(Date.UTC(year, month - 1, 1)),
        endDate: new Date(Date.UTC(year, month, 0)),
      },
    });

    const tenantStatutory = await this.prisma.statutoryTable.findFirst({
      where: {
        tenantId,
        country: "KH",
        kind: "TOS_NSSF",
        effective: { lte: period.endDate },
      },
      orderBy: { effective: "desc" },
    });
    const globalStatutory = tenantStatutory
      ? null
      : await this.prisma.statutoryTable.findFirst({
          where: {
            tenantId: null,
            country: "KH",
            kind: "TOS_NSSF",
            effective: { lte: period.endDate },
          },
          orderBy: { effective: "desc" },
        });
    const statutoryRecord = tenantStatutory ?? globalStatutory;
    const statutory = statutoryRecord?.payload ?? CAMBODIA_2026;
    if (!isCambodiaStatutoryConfig(statutory)) {
      throw new BadRequestException("Effective Cambodia statutory table is invalid");
    }
    const overtimePolicy = await this.prisma.overtimePolicy.findFirst({ where: { tenantId } });
    const overtimeRates = {
      weekday: Number(overtimePolicy?.weekdayRate ?? 1.5),
      night: Number(overtimePolicy?.nightRate ?? 2),
      rest: Number(overtimePolicy?.restDayRate ?? 2),
      holiday: Number(overtimePolicy?.holidayRate ?? 2),
    };

    const employees = await this.prisma.employee.findMany({
      where: { tenantId, status: { in: ["ACTIVE", "PROBATION"] }, deletedAt: null },
      include: {
        contracts: {
          where: { startDate: { lte: period.endDate }, OR: [{ endDate: null }, { endDate: { gte: period.startDate } }] },
          orderBy: { startDate: "desc" },
          take: 1,
        },
        dependents: { where: { qualifiesTos: true } },
        overtimes: {
          where: {
            status: "APPROVED",
            workDate: { gte: period.startDate, lte: period.endDate },
          },
        },
        leaves: {
          where: {
            status: "APPROVED",
            leaveType: { paid: false },
            startDate: { lte: period.endDate },
            endDate: { gte: period.startDate },
          },
          include: { leaveType: true },
        },
      },
    });

    if (fxUsdKhr === undefined && employees.some((employee) => employee.contracts[0]?.currency === "USD")) {
      throw new BadRequestException("Provide the USD to KHR exchange rate for this payroll run");
    }
    const appliedFxUsdKhr = fxUsdKhr ?? 4100;

    let totalGross = 0;
    let totalNet = 0;
    let totalTos = 0;
    let totalNssfEe = 0;
    let totalNssfEr = 0;
    const items: Omit<Prisma.PayrollItemCreateManyInput, "runId">[] = [];

    for (const emp of employees) {
      const contract = emp.contracts[0];
      if (!contract) continue;
      const fx = contract.currency === "USD" ? appliedFxUsdKhr : 1;
      const rawBasic = Number(contract.basicSalary);
      const rawAllowances = (contract.allowances as { amount?: number }[]).reduce(
        (s, a) => s + Number(a.amount ?? 0),
        0,
      );
      const activeFrom = contract.startDate > period.startDate ? contract.startDate : period.startDate;
      const activeTo = contract.endDate && contract.endDate < period.endDate ? contract.endDate : period.endDate;
      const activeDays = Math.max(0, Math.floor((activeTo.getTime() - activeFrom.getTime()) / 86400000) + 1);
      const monthDays = Math.floor((period.endDate.getTime() - period.startDate.getTime()) / 86400000) + 1;
      const prorata = activeDays / monthDays;
      const basic = Math.round(rawBasic * fx * prorata);
      const allowances = Math.round(rawAllowances * fx * prorata);
      const monthlyBasicKhr = Math.round(rawBasic * fx);
      const ot = emp.overtimes.reduce((s, o) => {
        const mult = overtimeRates[o.otType as keyof typeof overtimeRates] ?? overtimeRates.weekday;
        return s + overtimePay(monthlyBasicKhr, contract.workingDays, Number(contract.hoursPerDay), Number(o.hours), mult);
      }, 0);
      const unpaidDays = emp.leaves.reduce((s, l) => s + Number(l.days), 0);
      const daily = monthlyBasicKhr / contract.workingDays;
      const unpaidLeave = Math.round(daily * unpaidDays);
      const spouse = emp.dependents.some((d) => d.relationship === "spouse");
      const children = emp.dependents.filter((d) => d.relationship === "child").length;

      const result = calculatePayroll({
        basic,
        allowances,
        overtime: ot,
        unpaidLeave,
        fringeBenefits: 0,
        otherDeductions: 0,
        taxResidency: emp.taxResidency,
        qualifyingChildren: children,
        spouseRelief: spouse,
        statutory,
      });

      items.push({
        employeeId: emp.id,
        basic,
        allowances,
        overtime: ot,
        unpaidLeave,
        fringeBenefits: 0,
        gross: result.gross,
        tosBase: result.tosBase,
        tosAmount: result.tosAmount,
        fringeTax: result.fringeTax,
        nssfWage: result.nssf.contributoryWage,
        nssfPensionEe: result.nssf.pensionEe,
        nssfPensionEr: result.nssf.pensionEr,
        nssfHealthEr: result.nssf.healthEr,
        nssfRiskEr: result.nssf.riskEr,
        net: result.net,
        breakdown: {
          ...result,
          statutoryVersion: statutoryRecord?.version ?? "builtin-2026.1",
          contract: { id: contract.id, currency: contract.currency, originalBasicSalary: rawBasic, originalAllowances: rawAllowances, fxUsdKhr: fx, activeDays, periodDays: monthDays },
        } as unknown as Prisma.InputJsonValue,
      });

      totalGross += result.gross;
      totalNet += result.net;
      totalTos += result.tosAmount;
      totalNssfEe += result.nssf.employeeTotal;
      totalNssfEr += result.nssf.employerTotal;
    }

    if (!items.length) throw new BadRequestException("No active employees have a contract covering this payroll period");

    // Fetch prior approved/paid run for this tenant to compute MoM variance
    const priorRun = await this.prisma.payrollRun.findFirst({
      where: {
        tenantId,
        status: { in: ["APPROVED", "PAID"] },
        periodId: { not: period.id },
      },
      orderBy: { createdAt: "desc" },
      select: { totalGross: true },
    });

    const priorGross = priorRun ? Number(priorRun.totalGross) : 0;
    const variancePct = priorGross > 0 ? Math.abs(totalGross - priorGross) / priorGross : 0;
    const varianceFlag = variancePct > 0.10;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId}), hashtext(${period.id}))`;
      const existing = await tx.payrollRun.findFirst({ where: { tenantId, periodId: period.id, status: { not: "VOID" } }, select: { id: true } });
      if (existing) throw new BadRequestException("A payroll run already exists for this period; void it before recalculating");
      const run = await tx.payrollRun.create({
        data: {
          tenantId,
          periodId: period.id,
          status: "CALCULATED",
          submittedBy: actorId,
          fxUsdKhr: appliedFxUsdKhr,
          varianceFlag,
          variancePct: Math.round(variancePct * 10000) / 10000,
        },
      });
      if (items.length) await tx.payrollItem.createMany({ data: items.map((item) => ({ ...item, runId: run.id })) });
      return tx.payrollRun.update({
        where: { id: run.id },
        data: { totalGross, totalNet, totalTos, totalNssfEe, totalNssfEr, status: "PENDING_APPROVAL" },
        include: { items: true },
      });
    });

    this.events.emit(EVENTS.PAYROLL_CALCULATED, { tenantId, runId: updated.id });
    return updated;
  }

  async voidRun(tenantId: string, runId: string) {
    const result = await this.prisma.payrollRun.updateMany({
      where: { id: runId, tenantId, status: "PENDING_APPROVAL" },
      data: { status: "VOID" },
    });
    if (!result.count) {
      const exists = await this.prisma.payrollRun.findFirst({ where: { id: runId, tenantId } });
      if (!exists) throw new NotFoundException("Payroll run not found");
      throw new BadRequestException("Only a run pending approval can be voided");
    }
    return this.getRun(tenantId, runId);
  }

  async approve(tenantId: string, runId: string, actorId: string) {
    const run = await this.prisma.payrollRun.findFirst({ where: { id: runId, tenantId } });
    if (!run) throw new NotFoundException("Payroll run not found");
    if (run.status !== "PENDING_APPROVAL") throw new BadRequestException("Payroll run is not pending approval");

    // Segregation of Duties (SoD) enforcement
    if (run.submittedBy === actorId) {
      throw new ForbiddenException("Segregation of Duties violation: the payroll preparer cannot also approve. Assign a different approver.");
    }

    // 10% Variance Alert Gate enforcement
    if (run.varianceFlag && !run.varianceApprovedBy) {
      throw new BadRequestException("This payroll run has a variance exceeding 10.0%. A supervisor must submit variance justification before approval.");
    }

    const result = await this.prisma.payrollRun.updateMany({
      where: { id: runId, tenantId, status: "PENDING_APPROVAL" },
      data: { status: "APPROVED", approvedBy: actorId, approvedAt: new Date() },
    });
    if (result.count === 0) {
      throw new BadRequestException("Payroll run could not be approved");
    }
    const updated = await this.prisma.payrollRun.findFirstOrThrow({
      where: { id: runId, tenantId },
    });
    this.events.emit(EVENTS.PAYROLL_APPROVED, { tenantId, runId });
    await this.payslips.add("generate-run", { tenantId, runId });
    return updated;
  }

  async varianceApproval(tenantId: string, runId: string, actorId: string, justification: string) {
    if (!justification || justification.trim().length < 20) {
      throw new BadRequestException("A detailed variance justification (minimum 20 characters) is required");
    }
    const run = await this.prisma.payrollRun.findFirst({ where: { id: runId, tenantId } });
    if (!run) throw new NotFoundException("Payroll run not found");
    if (run.status !== "PENDING_APPROVAL") throw new BadRequestException("Only runs pending approval can receive variance approval");
    if (!run.varianceFlag) throw new BadRequestException("This payroll run does not require variance approval");

    return this.prisma.payrollRun.update({
      where: { id: runId },
      data: {
        varianceApprovedBy: actorId,
        varianceApprovedAt: new Date(),
        varianceJustification: justification.trim(),
      },
    });
  }

  async markPaid(tenantId: string, runId: string) {
    const result = await this.prisma.payrollRun.updateMany({
      where: { id: runId, tenantId, status: "APPROVED" },
      data: { status: "PAID", paidAt: new Date() },
    });
    if (result.count === 0) {
      const exists = await this.prisma.payrollRun.findFirst({ where: { id: runId, tenantId } });
      if (!exists) throw new NotFoundException();
      throw new BadRequestException("Only an approved payroll run can be marked paid");
    }
    const run = await this.prisma.payrollRun.findFirstOrThrow({
      where: { id: runId, tenantId },
    });
    this.events.emit(EVENTS.PAYROLL_PAID, { tenantId, runId });
    return run;
  }
}
