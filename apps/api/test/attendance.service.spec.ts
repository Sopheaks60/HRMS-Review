import { describe, expect, it, vi } from "vitest";
import { AttendanceService } from "../src/modules/attendance/attendance.service";

function createService(consumedCount: number) {
  const tx = {
    $queryRaw: vi.fn(),
    attendance: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "attendance-1", source: "FACE" }),
    },
    faceSelfie: { updateMany: vi.fn().mockResolvedValue({ count: consumedCount }) },
  };
  const prisma = {
    employee: { findFirst: vi.fn().mockResolvedValue({ id: "employee-1" }) },
    tenant: { findUnique: vi.fn().mockResolvedValue({ timezone: "Asia/Phnom_Penh" }) },
    faceSelfie: { findFirst: vi.fn().mockResolvedValue({ matchScore: 0.96, livenessScore: 0.94, createdAt: new Date(), usedAt: null }) },
    $transaction: vi.fn((callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  const events = { emit: vi.fn() };
  return { service: new AttendanceService(prisma as never, events as never), prisma, tx, events };
}

describe("AttendanceService face punches", () => {
  it("consumes a fresh verified proof once in the same transaction as the punch", async () => {
    const { service, tx, events } = createService(1);

    await expect(service.punch({ tenantId: "tenant-1", employeeId: "employee-1", type: "CLOCK_IN", source: "FACE", selfieId: "selfie-1" })).resolves.toMatchObject({ id: "attendance-1" });
    expect(tx.faceSelfie.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "selfie-1", usedAt: null }), data: { usedAt: expect.any(Date) } }));
    expect(tx.attendance.create).toHaveBeenCalledOnce();
    expect(events.emit).toHaveBeenCalledOnce();
  });

  it("rejects an already consumed face proof", async () => {
    const { service, tx } = createService(0);

    await expect(service.punch({ tenantId: "tenant-1", employeeId: "employee-1", type: "CLOCK_IN", source: "FACE", selfieId: "selfie-1" })).rejects.toThrow("expired or has already been used");
    expect(tx.attendance.create).not.toHaveBeenCalled();
  });
});
