import { Controller, Get, UseGuards, Module } from "@nestjs/common";
import { CurrentUser, type AuthPrincipal } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PrismaService } from "../../prisma/prisma.service";

@Controller("rbac")
@UseGuards(PermissionsGuard)
class RbacController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("roles")
  @RequirePermissions("rbac.write")
  roles(@CurrentUser() user: AuthPrincipal) {
    return this.prisma.role.findMany({
      where: { tenantId: user.tenantId },
      include: { permissions: { include: { permission: true } } },
    });
  }

  @Get("permissions")
  @RequirePermissions("rbac.write")
  permissions() {
    return this.prisma.permission.findMany();
  }
}

@Module({ controllers: [RbacController] })
export class RbacModule {}
