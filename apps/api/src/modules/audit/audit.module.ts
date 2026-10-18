import { Controller, Get, Query, UseGuards, Module } from "@nestjs/common";
import { CurrentUser, type AuthPrincipal } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PrismaService } from "../../prisma/prisma.service";

@Controller("audit")
@UseGuards(PermissionsGuard)
class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions("audit.read")
  list(@CurrentUser() user: AuthPrincipal, @Query("entity") entity?: string) {
    return this.prisma.auditLog.findMany({
      where: { tenantId: user.tenantId, entity: entity || undefined },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }
}

@Module({ controllers: [AuditController] })
export class AuditModule {}
