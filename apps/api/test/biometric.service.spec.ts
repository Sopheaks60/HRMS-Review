import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { BiometricService } from "../src/modules/biometric/biometric.service";

describe("BiometricService ADMS adapter", () => {
  it("verifies timestamped gateway signatures and rejects stale messages", () => {
    const secret = "gateway-test-secret";
    const config = { getOrThrow: vi.fn(() => secret) };
    const service = new BiometricService({} as never, {} as never, config as never);
    const body = "1\t2026-10-15 09:00:00\t0\t1\t0";
    const timestamp = new Date().toISOString();
    const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");

    expect(() => service.verifyWebhook(body, signature, timestamp)).not.toThrow();
    expect(() => service.verifyWebhook(body, signature, new Date(Date.now() - 6 * 60_000).toISOString())).toThrow("expired");
  });

  it("parses ADMS ATTLOG local time using the device tenant timezone", async () => {
    const device = { id: "device-1", tenantId: "tenant-1", serialNo: "SN-1", pushEnabled: true };
    const prisma = {
      biometricDevice: { findMany: vi.fn().mockResolvedValue([device]), update: vi.fn().mockResolvedValue(device) },
      tenant: { findUnique: vi.fn().mockResolvedValue({ timezone: "Asia/Phnom_Penh" }) },
      biometricPunch: { upsert: vi.fn().mockResolvedValue({ id: "punch-1", attendanceId: null }) },
      employee: { findFirst: vi.fn().mockResolvedValue(null) },
      runAsTenant: vi.fn((_tenantId: string, fn: () => unknown) => fn()),
    };
    const service = new BiometricService(prisma as never, {} as never, { getOrThrow: vi.fn() } as never);

    await expect(service.ingestAttlog("SN-1", "1001\t2026-10-15 09:00:00\t0\t15\t0\r\n")).resolves.toEqual({ accepted: 1 });
    expect(prisma.biometricPunch.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { deviceId_pin_punchedAt: { deviceId: "device-1", pin: "1001", punchedAt: new Date("2026-10-15T02:00:00.000Z") } },
      create: expect.objectContaining({ verifyMode: 15 }),
    }));
  });

  it("rejects malformed and oversized ADMS uploads", async () => {
    const service = new BiometricService({} as never, {} as never, {} as never);
    await expect(service.ingestAttlog("SN-1", "x".repeat(5 * 1024 * 1024 + 1))).rejects.toThrow("exceeds 5 MB");
  });
});
