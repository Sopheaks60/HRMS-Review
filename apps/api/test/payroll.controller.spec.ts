import { describe, expect, it, vi } from "vitest";
import { PayrollController } from "../src/modules/payroll/payroll.controller";

describe("PayrollController", () => {
  const user = { userId: "user-1", tenantId: "tenant-1", permissions: ["payroll.read", "payroll.run", "payroll.approve"] };

  it("scopes history and details to the authenticated tenant", async () => {
    const payroll = { listRuns: vi.fn().mockResolvedValue([]), getRun: vi.fn().mockResolvedValue({ id: "run-1" }) };
    const controller = new PayrollController(payroll as never);

    await controller.listRuns(user);
    await controller.getRun(user, "run-1");

    expect(payroll.listRuns).toHaveBeenCalledWith("tenant-1");
    expect(payroll.getRun).toHaveBeenCalledWith("tenant-1", "run-1");
  });

  it("passes the explicit USD/KHR rate through to calculation", async () => {
    const payroll = { calculate: vi.fn().mockResolvedValue({ id: "run-1" }) };
    const controller = new PayrollController(payroll as never);

    await controller.calculate(user, { year: 2026, month: 10, fxUsdKhr: 4105.25 });

    expect(payroll.calculate).toHaveBeenCalledWith("tenant-1", 2026, 10, "user-1", 4105.25);
  });
});
