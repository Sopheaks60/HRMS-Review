import { Body, Controller, Get, Param, Post, UseGuards, Module, BadRequestException, NotFoundException } from "@nestjs/common";
import { IsUUID } from "class-validator";
import { CurrentUser, type AuthPrincipal } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PrismaService } from "../../prisma/prisma.service";

class AssignAssetDto {
  @IsUUID()
  employeeId: string;
}

@Controller("assets")
@UseGuards(PermissionsGuard)
class AssetsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions("asset.write")
  list(@CurrentUser() user: AuthPrincipal) {
    return this.prisma.asset.findMany({
      where: { tenantId: user.tenantId },
      include: {
        assignments: {
          where: { returnedAt: null },
          include: {
            employee: {
              select: { id: true, employeeNo: true, firstNameEn: true, lastNameEn: true },
            },
          },
          orderBy: { assignedAt: "desc" },
        },
      },
    });
  }

  @Post()
  @RequirePermissions("asset.write")
  create(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: { tag: string; name: string; category: string },
  ) {
    return this.prisma.asset.create({
      data: { tag: dto.tag, name: dto.name, category: dto.category, tenantId: user.tenantId },
    });
  }

  @Post(":id/assign")
  @RequirePermissions("asset.write")
  async assign(
    @CurrentUser() user: AuthPrincipal,
    @Param("id") id: string,
    @Body() dto: AssignAssetDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.asset.findFirst({
        where: { id, tenantId: user.tenantId },
      });
      if (!asset) throw new NotFoundException("Asset not found");
      if (asset.status !== "available") throw new BadRequestException("Asset is not available");

      const employee = await tx.employee.findFirst({
        where: { id: dto.employeeId, tenantId: user.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!employee) throw new NotFoundException("Employee not found");

      const activeAssignment = await tx.assetAssignment.findFirst({
        where: { assetId: id, returnedAt: null },
        select: { id: true },
      });
      if (activeAssignment) throw new BadRequestException("Asset already has an active assignment");

      const claimed = await tx.asset.updateMany({
        where: { id, tenantId: user.tenantId, status: "available" },
        data: { status: "assigned" },
      });
      if (claimed.count !== 1) throw new BadRequestException("Asset is no longer available");
      return tx.assetAssignment.create({
        data: { assetId: id, employeeId: employee.id },
        include: { employee: { select: { id: true, employeeNo: true, firstNameEn: true, lastNameEn: true } } },
      });
    });
  }

  @Post(":id/return")
  @RequirePermissions("asset.write")
  async returnAsset(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) {
    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.asset.findFirst({ where: { id, tenantId: user.tenantId } });
      if (!asset) throw new NotFoundException("Asset not found");
      const assignment = await tx.assetAssignment.findFirst({
        where: { assetId: id, returnedAt: null },
      });
      if (!assignment) throw new BadRequestException("Asset has no active assignment");

      const now = new Date();
      const closed = await tx.assetAssignment.updateMany({
        where: { id: assignment.id, returnedAt: null },
        data: { returnedAt: now },
      });
      if (closed.count !== 1) throw new BadRequestException("Asset assignment was already returned");
      const released = await tx.asset.updateMany({
        where: { id, tenantId: user.tenantId, status: "assigned" },
        data: { status: "available" },
      });
      if (released.count !== 1) throw new BadRequestException("Asset is not currently assigned");
      return { ...assignment, returnedAt: now };
    });
  }
}

@Module({ controllers: [AssetsController] })
export class AssetsModule {}
