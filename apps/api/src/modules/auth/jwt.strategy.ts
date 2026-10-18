import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthPrincipal } from "../../common/decorators/current-user.decorator";

type JwtPayload = { sub: string; tid: string };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow("JWT_ACCESS_SECRET"),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthPrincipal> {
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, tenantId: payload.tid, deletedAt: null },
      include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });
    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException();
    }
    const permissions = [
      ...new Set(
        user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.code)),
      ),
    ];
    return {
      userId: user.id,
      tenantId: user.tenantId,
      permissions,
      employeeId: user.employeeId ?? undefined,
    };
  }
}
