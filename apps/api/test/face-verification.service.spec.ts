import { afterEach, describe, expect, it, vi } from "vitest";
import { FaceVerificationService } from "../src/modules/attendance/face-verification.service";

describe("FaceVerificationService", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("stores only provider-verified selfies and persists independent match and liveness scores", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ verified: true, matchScore: 0.94, livenessScore: 0.91 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const storage = { defaultBucket: "private", putObject: vi.fn().mockResolvedValue(undefined) };
    const tx = {
      storedFile: { create: vi.fn().mockResolvedValue({ id: "file-1" }) },
      faceSelfie: { create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: data.id, matchScore: data.matchScore, livenessScore: data.livenessScore })) },
    };
    const prisma = { ...tx, $transaction: vi.fn((callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)) };
    Object.assign(prisma, { employee: { findFirst: vi.fn().mockResolvedValue({ id: "employee-1" }) } });
    const config = { get: vi.fn((key: string) => ({ FACE_VERIFICATION_URL: "https://face.example.test/verify", FACE_VERIFICATION_TOKEN: "server-secret", NODE_ENV: "production" } as Record<string, string>)[key]) };
    const service = new FaceVerificationService(prisma as never, storage as never, config as never);
    const image = Buffer.from("selfie-bytes").toString("base64");

    await expect(service.verifyAndSave("tenant-1", "employee-1", `data:image/jpeg;base64,${image}`)).resolves.toMatchObject({ matchScore: 0.94, livenessScore: 0.91 });
    expect(fetchMock).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ headers: expect.objectContaining({ authorization: "Bearer server-secret" }) }));
    expect(storage.putObject).toHaveBeenCalledWith(expect.stringMatching(/^tenants\/tenant-1\/employees\/employee-1\/attendance-selfies\/.+\.jpg$/), expect.any(Buffer), "image/jpeg");
    expect(prisma.faceSelfie.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ fileId: "file-1", matchScore: 0.94, livenessScore: 0.91 }) }));
  });

  it("fails closed when the verification provider is not configured", async () => {
    const storage = { defaultBucket: "private", putObject: vi.fn() };
    const prisma = { employee: { findFirst: vi.fn().mockResolvedValue({ id: "employee-1" }) }, storedFile: { create: vi.fn() }, faceSelfie: { create: vi.fn() }, $transaction: vi.fn() };
    const config = { get: vi.fn(() => undefined) };
    const service = new FaceVerificationService(prisma as never, storage as never, config as never);

    await expect(service.verifyAndSave("tenant-1", "employee-1", "data:image/jpeg;base64,aGVsbG8=")).rejects.toThrow("not configured");
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(prisma.faceSelfie.create).not.toHaveBeenCalled();
  });

  it("rejects provider results below the server-side liveness threshold", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ verified: true, matchScore: 0.99, livenessScore: 0.2 }), { status: 200 })));
    const storage = { defaultBucket: "private", putObject: vi.fn() };
    const prisma = {
      employee: { findFirst: vi.fn().mockResolvedValue({ id: "employee-1" }) },
      storedFile: { create: vi.fn() },
      faceSelfie: { create: vi.fn() },
      $transaction: vi.fn(),
    };
    const config = { get: vi.fn((key: string) => ({ FACE_VERIFICATION_URL: "https://face.example.test/verify", FACE_VERIFICATION_TOKEN: "secret" } as Record<string, string>)[key]) };
    const service = new FaceVerificationService(prisma as never, storage as never, config as never);

    await expect(service.verifyAndSave("tenant-1", "employee-1", `data:image/jpeg;base64,${Buffer.from("selfie").toString("base64")}`)).rejects.toThrow("liveness verification failed");
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(prisma.faceSelfie.create).not.toHaveBeenCalled();
  });

  it("rejects invalid or oversized image payloads before contacting the provider", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const storage = { defaultBucket: "private", putObject: vi.fn() };
    const prisma = { employee: { findFirst: vi.fn().mockResolvedValue({ id: "employee-1" }) }, storedFile: { create: vi.fn() }, faceSelfie: { create: vi.fn() }, $transaction: vi.fn() };
    const config = { get: vi.fn((key: string) => ({ FACE_VERIFICATION_URL: "https://face.example.test/verify", FACE_VERIFICATION_TOKEN: "secret" } as Record<string, string>)[key]) };
    const service = new FaceVerificationService(prisma as never, storage as never, config as never);

    await expect(service.verifyAndSave("tenant-1", "employee-1", "data:image/svg+xml;base64,PHN2Zz4=" )).rejects.toThrow("JPEG, PNG, or WebP");
    await expect(service.verifyAndSave("tenant-1", "employee-1", `data:image/jpeg;base64,${"a".repeat(7_000_001)}`)).rejects.toThrow("5 MB");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
