import { describe, expect, it, vi } from "vitest";
import { PiiEncryptionService } from "../src/common/services/pii-encryption.service";

describe("PiiEncryptionService", () => {
  const key = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const createService = (value = key) => new PiiEncryptionService({ getOrThrow: vi.fn(() => value) } as never);

  it("encrypts with randomized AES-GCM envelopes and decrypts only with the correct key", () => {
    const service = createService();
    const first = service.encrypt("  National ID  ")!;
    const second = service.encrypt("National ID")!;

    expect(first).not.toBe(second);
    expect(first.startsWith("v1.")).toBe(true);
    expect(service.decrypt(first)).toBe("National ID");
    expect(() => createService("f".repeat(64)).decrypt(first)).toThrow("could not be decrypted");
  });

  it("supports clearing a value and rejects malformed stored envelopes", () => {
    const service = createService();
    expect(service.encrypt("  ")).toBeNull();
    expect(service.decrypt(null)).toBeNull();
    expect(() => service.decrypt("plaintext" )).toThrow("not in a supported encrypted format");
  });

  it("requires a 256-bit hexadecimal key", () => {
    expect(() => createService("too-short")).toThrow("32-byte hexadecimal");
  });
});
