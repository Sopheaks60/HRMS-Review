import { Body, Controller, Post, Module } from "@nestjs/common";
import { IsEmail, IsString } from "class-validator";
import * as argon2 from "argon2";
import { Public } from "../../common/decorators/public.decorator";
import { PrismaService } from "../../prisma/prisma.service";

class SignupDto {
  @IsString() slug: string;
  @IsString() name: string;
  @IsEmail() ownerEmail: string;
  @IsString() ownerName: string;
  @IsString() password: string;
}

@Controller("tenants")
class TenantsController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Post()
  async provision(@Body() dto: SignupDto) {
    const passwordHash = await argon2.hash(dto.password);
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          slug: dto.slug.toLowerCase(),
          name: dto.name,
          trialEndsAt: new Date(Date.now() + 14 * 86400000),
        },
      });
      const perms = await tx.permission.findMany();
      const ownerRole = await tx.role.create({
        data: {
          tenantId: tenant.id,
          code: "OWNER",
          nameEn: "Owner",
          nameKm: "ម្ចាស់គណនី",
          isSystem: true,
        },
      });
      await tx.rolePermission.createMany({
        data: perms.map((p) => ({ roleId: ownerRole.id, permissionId: p.id })),
      });
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.ownerEmail.toLowerCase(),
          passwordHash,
          displayName: dto.ownerName,
          status: "ACTIVE",
        },
      });
      await tx.userRole.create({ data: { userId: user.id, roleId: ownerRole.id } });
      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          plan: "STARTER",
          seats: 25,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 14 * 86400000),
        },
      });
      return { tenantId: tenant.id, slug: tenant.slug };
    });
  }
}

@Module({ controllers: [TenantsController] })
export class TenantsModule {}
