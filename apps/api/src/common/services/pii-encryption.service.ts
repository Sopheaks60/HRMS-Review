import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

@Injectable()
export class PiiEncryptionService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const rawKey = config.getOrThrow<string>("PII_ENCRYPTION_KEY");
    if (!/^[a-fA-F0-9]{64}$/.test(rawKey)) {
      throw new Error("PII_ENCRYPTION_KEY must be a 32-byte hexadecimal key");
    }
    this.key = Buffer.from(rawKey, "hex");
  }

  encrypt(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    if (!normalized) return null;
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
  }

  decrypt(value: string | null | undefined): string | null {
    if (!value) return null;
    const parts = value.split(".");
    if (parts.length !== 4 || parts[0] !== "v1") {
      throw new InternalServerErrorException("Stored PII is not in a supported encrypted format");
    }
    try {
      const iv = Buffer.from(parts[1]!, "base64url");
      const tag = Buffer.from(parts[2]!, "base64url");
      const ciphertext = Buffer.from(parts[3]!, "base64url");
      if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) throw new Error("Invalid ciphertext");
      const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    } catch {
      throw new InternalServerErrorException("Stored PII could not be decrypted");
    }
  }
}
