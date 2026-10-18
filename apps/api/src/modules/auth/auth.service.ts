import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string, tenantSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant || tenant.status === "SUSPENDED" || tenant.status === "CANCELLED") {
      throw new UnauthorizedException("Invalid credentials");
    }
    const user = await this.prisma.user.findFirst({
      where: { tenantId: tenant.id, email: email.toLowerCase(), deletedAt: null },
    });
    if (!user) throw new UnauthorizedException("Invalid credentials");
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException("Account locked");
    }
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) {
      const fails = user.failedLogins + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLogins: fails,
          lockedUntil: fails >= 8 ? new Date(Date.now() + 15 * 60_000) : null,
          status: fails >= 8 ? "LOCKED" : user.status,
        },
      });
      throw new UnauthorizedException("Invalid credentials");
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lastLoginAt: new Date(), status: "ACTIVE", lockedUntil: null },
    });
    return this.issueTokens(user.id, tenant.id);
  }

  async issueTokens(userId: string, tenantId: string) {
    const accessToken = await this.jwt.signAsync({ sub: userId, tid: tenantId });
    const refresh = randomBytes(48).toString("hex");
    const tokenHash = createHash("sha256").update(refresh).digest("hex");
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600_000),
      },
    });
    return { accessToken, refreshToken: refresh, tokenType: "Bearer", expiresIn: 900 };
  }

  async refresh(refreshToken: string) {
    const tokenHash = createHash("sha256").update(refreshToken).digest("hex");
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    if (!stored) throw new UnauthorizedException();
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(stored.userId, stored.user.tenantId);
  }
}
