import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, createHmac } from "node:crypto";

/** Minimal path-style S3 client using SigV4; works with S3 and RustFS/MinIO. */
@Injectable()
export class S3StorageService {
  private readonly endpoint: URL;
  private readonly region: string;
  private readonly bucket: string;
  private readonly accessKey: string;
  private readonly secretKey: string;

  constructor(config: ConfigService) {
    this.endpoint = new URL(config.get<string>("S3_ENDPOINT", "http://localhost:9000"));
    this.region = config.get<string>("S3_REGION", "us-east-1");
    this.bucket = config.get<string>("S3_BUCKET", "krompay");
    this.accessKey = config.getOrThrow<string>("S3_ACCESS_KEY");
    this.secretKey = config.getOrThrow<string>("S3_SECRET_KEY");
  }

  get defaultBucket() {
    return this.bucket;
  }

  async putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
    const path = `/${this.bucket}/${this.encodeKey(key)}`;
    let response = await this.request("PUT", path, body, contentType);
    if (response.status === 404) {
      await this.createBucket();
      response = await this.request("PUT", path, body, contentType);
    }
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`S3 PUT failed (${response.status}): ${detail.slice(0, 500)}`);
    }
  }

  async getObject(key: string): Promise<Buffer> {
    const response = await this.request(`GET`, `/${this.bucket}/${this.encodeKey(key)}`);
    if (!response.ok) {
      throw new Error(`S3 GET failed (${response.status})`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  async deleteObject(key: string): Promise<void> {
    const response = await this.request("DELETE", `/${this.bucket}/${this.encodeKey(key)}`);
    if (!response.ok && response.status !== 404) {
      throw new Error(`S3 DELETE failed (${response.status})`);
    }
  }

  private async createBucket(): Promise<void> {
    const response = await this.request("PUT", `/${this.bucket}`, new Uint8Array());
    if (!response.ok && response.status !== 409) {
      throw new Error(`S3 bucket initialization failed (${response.status})`);
    }
  }

  private async request(
    method: "GET" | "PUT" | "DELETE",
    path: string,
    body: Uint8Array = new Uint8Array(),
    contentType?: string,
  ): Promise<Response> {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = createHash("sha256").update(body).digest("hex");
    const canonicalUri = path.split("/").map((part, i) => i === 0 ? "" : encodeURIComponent(decodeURIComponent(part))).join("/");
    const headers: Record<string, string> = {
      host: this.endpoint.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };
    if (contentType) headers["content-type"] = contentType;
    const signedHeaders = Object.keys(headers).sort().join(";");
    const canonicalHeaders = Object.keys(headers).sort().map((key) => `${key}:${headers[key]!.trim()}\n`).join("");
    const canonicalRequest = [method, canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const scope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      scope,
      createHash("sha256").update(canonicalRequest).digest("hex"),
    ].join("\n");
    const dateKey = this.hmac(Buffer.from(`AWS4${this.secretKey}`), dateStamp);
    const regionKey = this.hmac(dateKey, this.region);
    const serviceKey = this.hmac(regionKey, "s3");
    const signingKey = this.hmac(serviceKey, "aws4_request");
    const signature = this.hmac(signingKey, stringToSign).toString("hex");
    headers.authorization = `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const url = new URL(this.endpoint);
    url.pathname = `${url.pathname.replace(/\/$/, "")}${canonicalUri}`;
    return fetch(url, { method, headers, body: method === "PUT" ? new Uint8Array(body) : undefined });
  }

  private encodeKey(key: string): string {
    return key.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  }

  private hmac(key: Buffer, value: string): Buffer {
    return createHmac("sha256", key).update(value).digest();
  }
}
