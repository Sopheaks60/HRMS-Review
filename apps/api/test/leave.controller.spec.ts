import { describe, expect, it, vi } from "vitest";
import { LeaveController } from "../src/modules/leave/leave.module";

describe("LeaveController", () => {
  it("serializes employee submissions and rejects overlapping requests inside the transaction", async () => {
    const tx = {
      $queryRaw: vi.fn(),
      leaveRequest: { findFirst: vi.fn().mockResolvedValue({ id: "existing" }), create: vi.fn() },
      leaveBalance: { findUnique: vi.fn(), upsert: vi.fn() },
    };
    const prisma = {
      leaveType: { findFirst: vi.fn().mockResolvedValue({ id: "type-1", paid: true, annualQuotaDays: 18 }) },
      $transaction: vi.fn((callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const controller = new LeaveController(prisma as never, { emit: vi.fn() } as never);

    await expect(controller.create({ userId: "user-1", tenantId: "tenant-1", employeeId: "employee-1", permissions: ["leave.apply"] }, {
      leaveTypeId: "type-1",
      startDate: "2026-10-20",
      endDate: "2026-10-21",
    })).rejects.toThrow("overlap an existing request");

    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.leaveRequest.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ employeeId: "employee-1", tenantId: "tenant-1" }) }));
    expect(tx.leaveRequest.create).not.toHaveBeenCalled();
    expect(tx.leaveBalance.upsert).not.toHaveBeenCalled();
  });
});
