import { afterEach, describe, expect, it, vi } from "vitest";
import { S3StorageService } from "../src/storage/s3-storage.service";

const config = {
  get: (key: string, fallback: string) =>
    ({ S3_ENDPOINT: "http://storage.test:9000", S3_REGION: "us-east-1", S3_BUCKET: "krompay" })[key] ?? fallback,
  getOrThrow: (key: string) =>
    ({ S3_ACCESS_KEY: "test-access", S3_SECRET_KEY: "test-secret" })[key],
};

describe("S3StorageService", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("signs and writes tenant-scoped object keys", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const storage = new S3StorageService(config as never);

    await storage.putObject("tenants/tenant-1/payslips/run-1/employee-1.pdf", Buffer.from("pdf"), "application/pdf");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/krompay/tenants/tenant-1/payslips/run-1/employee-1.pdf");
    expect(init.method).toBe("PUT");
    expect((init.headers as Record<string, string>).authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=test-access\//,
    );
  });

  it("creates a missing bucket and retries the upload", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("NoSuchBucket", { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const storage = new S3StorageService(config as never);

    await storage.putObject("test.pdf", Buffer.from("pdf"), "application/pdf");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect((fetchMock.mock.calls[1]![0] as URL).pathname).toBe("/krompay");
  });

  it("downloads object bytes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("pdf-bytes", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const storage = new S3StorageService(config as never);

    const result = await storage.getObject("private/file.pdf");

    expect(result.toString()).toBe("pdf-bytes");
    expect((fetchMock.mock.calls[0]![0] as URL).pathname).toBe("/krompay/private/file.pdf");
  });
});
