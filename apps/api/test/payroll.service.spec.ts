import { describe, expect, it, vi } from "vitest";
import { calculatePayroll } from "@krompay/shared";
import { PayrollService } from "../src/modules/payroll/payroll.service";

function setup(existingRun: { id: string } | null = null) {
  const period = { id: "period-1", startDate: new Date("2026-10-01T00:00:00.000Z"), endDate: new Date("2026-10-31T00:00:00.000Z") };
  const employee = {
    id: "employee-1",
    taxResidency: "RESIDENT",
    contracts: [{ id: "contract-1", currency: "KHR", basicSalary: 1_000_000, allowances: [], startDate: period.startDate, endDate: null, workingDays: 26, hoursPerDay: 8 }],
    dependents: [], overtimes: [], leaves: [],
  };
  const tx = {
    $queryRaw: vi.fn(),
    payrollRun: {
      findFirst: vi.fn().mockResolvedValue(existingRun),
      create: vi.fn().mockResolvedValue({ id: "run-1" }),
      update: vi.fn().mockResolvedValue({ id: "run-1", status: "PENDING_APPROVAL", items: [{ id: "item-1" }] }),
    },
    payrollItem: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  const prisma = {
    payrollPeriod: { upsert: vi.fn().mockResolvedValue(period) },
    statutoryTable: { findFirst: vi.fn().mockResolvedValue(null) },
    overtimePolicy: { findFirst: vi.fn().mockResolvedValue(null) },
    employee: { findMany: vi.fn().mockResolvedValue([employee]) },
    payrollRun: { findFirst: vi.fn().mockResolvedValue(null), findFirstOrThrow: vi.fn().mockResolvedValue({ id: "run-1" }) },
    $transaction: vi.fn((callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  const events = { emit: vi.fn() };
  const service = new PayrollService(prisma as never, events as never, { add: vi.fn() } as never);
  return { service, prisma, tx, events };
}

describe("PayrollService run creation", () => {
  it("creates a single period run and all item rows atomically", async () => {
    const { service, tx, events } = setup();

    await expect(service.calculate("tenant-1", 2026, 10, "actor-1", 4100)).resolves.toMatchObject({ id: "run-1", status: "PENDING_APPROVAL" });

    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.payrollRun.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: "tenant-1", periodId: "period-1", fxUsdKhr: 4100 }) }));
    expect(tx.payrollItem.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({ runId: "run-1", employeeId: "employee-1" })] }));
    expect(tx.payrollRun.update).toHaveBeenCalledOnce();
    expect(events.emit).toHaveBeenCalledOnce();
  });

  it("does not create a competing run for a period that already has one", async () => {
    const { service, tx } = setup({ id: "existing-run" });

    await expect(service.calculate("tenant-1", 2026, 10, "actor-1", 4100)).rejects.toThrow("already exists for this period");
    expect(tx.payrollRun.create).not.toHaveBeenCalled();
    expect(tx.payrollItem.createMany).not.toHaveBeenCalled();
  });

  it("requires an explicit exchange rate when an active contract is denominated in USD", async () => {
    const { service, prisma, tx } = setup();
    vi.mocked(prisma.employee.findMany).mockResolvedValueOnce([{
      id: "employee-1", taxResidency: "RESIDENT",
      contracts: [{ id: "contract-usd", currency: "USD", basicSalary: 500, allowances: [], startDate: new Date("2026-10-01"), endDate: null, workingDays: 26, hoursPerDay: 8 }],
      dependents: [], overtimes: [], leaves: [],
    }] as never);

    await expect(service.calculate("tenant-1", 2026, 10, "actor-1")).rejects.toThrow("Provide the USD to KHR exchange rate");
    expect(tx.payrollRun.create).not.toHaveBeenCalled();
  });
});

describe("payroll statutory calculation contract", () => {
  it("keeps Tax on Salary independent from NSSF deductions", () => {
    const result = calculatePayroll({
      basic: 2_000_000,
      allowances: 0,
      overtime: 0,
      unpaidLeave: 0,
      fringeBenefits: 0,
      otherDeductions: 0,
      taxResidency: "RESIDENT",
      qualifyingChildren: 0,
      spouseRelief: false,
    });

    expect(result.nssf.employeeTotal).toBeGreaterThan(0);
    expect(result.tosAmount).toBeGreaterThan(0);
    expect(result.tosBase).toBe(2_000_000);
  });
});
