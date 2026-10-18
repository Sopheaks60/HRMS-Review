import { BadGatewayException, BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { S3StorageService } from "../../storage/s3-storage.service";

const MAX_SELFIE_BYTES = 5 * 1024 * 1024;
const MIN_SCORE = 0.85;

@Injectable()
export class FaceVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: S3StorageService,
    private readonly config: ConfigService,
  ) {}

  async verifyAndSave(tenantId: string, employeeId: string, imageDataUrl: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) throw new BadRequestException("Employee is not active in this tenant");
    const parsed = this.parseImage(imageDataUrl);
    const verifierUrl = this.config.get<string>("FACE_VERIFICATION_URL");
    const verifierToken = this.config.get<string>("FACE_VERIFICATION_TOKEN");
    if (!verifierUrl || !verifierToken) {
      throw new ServiceUnavailableException("Face verification is not configured for this deployment");
    }
    let endpoint: URL;
    try {
      endpoint = new URL(verifierUrl);
    } catch {
      throw new ServiceUnavailableException("Face verification endpoint configuration is invalid");
    }
    if (endpoint.protocol !== "https:" && !(this.config.get<string>("NODE_ENV") === "development" && ["localhost", "127.0.0.1"].includes(endpoint.hostname))) {
      throw new ServiceUnavailableException("Face verification endpoint must use HTTPS");
    }

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { authorization: `Bearer ${verifierToken}`, "content-type": "application/json" },
        body: JSON.stringify({ action: "verify", tenantId, employeeId, imageBase64: parsed.base64 }),
        signal: AbortSignal.timeout(10_000),
        redirect: "error",
      });
    } catch {
      throw new BadGatewayException("Face verification provider is unavailable");
    }
    if (!response.ok) throw new BadGatewayException("Face verification provider rejected the request");

    let result: { verified?: unknown; matchScore?: unknown; livenessScore?: unknown };
    try {
      result = await response.json() as typeof result;
    } catch {
      throw new BadGatewayException("Face verification provider returned an invalid response");
    }
    const matchScore = Number(result.matchScore);
    const livenessScore = Number(result.livenessScore);
    if (result.verified !== true || !Number.isFinite(matchScore) || !Number.isFinite(livenessScore) || matchScore < MIN_SCORE || livenessScore < MIN_SCORE || matchScore > 1 || livenessScore > 1) {
      throw new BadRequestException("Face match or liveness verification failed");
    }

    const id = randomUUID();
    const key = `tenants/${tenantId}/employees/${employeeId}/attendance-selfies/${id}.${parsed.extension}`;
    await this.storage.putObject(key, parsed.bytes, parsed.mimeType);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const file = await tx.storedFile.create({
          data: { tenantId, bucket: this.storage.defaultBucket, key, mimeType: parsed.mimeType, sizeBytes: parsed.bytes.length },
          select: { id: true },
        });
        return tx.faceSelfie.create({
          data: { id, employeeId, fileId: file.id, matchScore, livenessScore },
          select: { id: true, matchScore: true, livenessScore: true, createdAt: true },
        });
      });
    } catch (error) {
      await this.storage.deleteObject(key).catch(() => undefined);
      throw error;
    }
  }

  private parseImage(dataUrl: string) {
    const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
    if (!match) throw new BadRequestException("Selfie must be a JPEG, PNG, or WebP data URL");
    const base64 = match[2]!;
    if (base64.length > Math.ceil(MAX_SELFIE_BYTES / 3) * 4) throw new BadRequestException("Selfie exceeds the 5 MB size limit");
    const bytes = Buffer.from(base64, "base64");
    if (bytes.length === 0 || bytes.length > MAX_SELFIE_BYTES || bytes.toString("base64") !== base64) {
      throw new BadRequestException("Selfie image data is invalid or exceeds the 5 MB size limit");
    }
    const format = match[1]!;
    return {
      base64,
      bytes,
      extension: format === "jpeg" ? "jpg" : format,
      mimeType: `image/${format}`,
    };
  }
}
