import {
  Body,
  ConflictException,
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";
import { CurrentUser, type AuthPrincipal } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PrismaService } from "../../prisma/prisma.service";

class BranchDto {
  @IsString() @MinLength(1) @MaxLength(32) code: string;
  @IsString() @MinLength(1) @MaxLength(160) nameEn: string;
  @IsString() @MinLength(1) @MaxLength(160) nameKm: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @IsString() @MaxLength(80) timezone?: string;
  @IsOptional() @IsBoolean() isHq?: boolean;
}

class DepartmentDto {
  @IsString() @MinLength(1) @MaxLength(32) code: string;
  @IsString() @MinLength(1) @MaxLength(160) nameEn: string;
  @IsString() @MinLength(1) @MaxLength(160) nameKm: string;
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @IsUUID() managerId?: string;
}

class PositionDto {
  @IsString() @MinLength(1) @MaxLength(32) code: string;
  @IsString() @MinLength(1) @MaxLength(160) titleEn: string;
  @IsString() @MinLength(1) @MaxLength(160) titleKm: string;
  @IsOptional() @IsString() @MaxLength(40) grade?: string;
}

class CostCenterDto {
  @IsString() @MinLength(1) @MaxLength(32) code: string;
  @IsString() @MinLength(1) @MaxLength(160) name: string;
}

@Controller("organization")
@UseGuards(PermissionsGuard)
export class OrganizationController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("tree")
  @RequirePermissions("employee.read")
  async tree(@CurrentUser() user: AuthPrincipal) {
    const [branches, departments, positions, costCenters] = await Promise.all([
      this.prisma.branch.findMany({ where: { tenantId: user.tenantId }, orderBy: { code: "asc" } }),
      this.prisma.department.findMany({ where: { tenantId: user.tenantId }, orderBy: { code: "asc" } }),
      this.prisma.position.findMany({ where: { tenantId: user.tenantId }, orderBy: { code: "asc" } }),
      this.prisma.costCenter.findMany({ where: { tenantId: user.tenantId }, orderBy: { code: "asc" } }),
    ]);
    return { branches, departments, positions, costCenters };
  }

  @Post("branches")
  @RequirePermissions("org.write")
  async createBranch(@CurrentUser() user: AuthPrincipal, @Body() dto: BranchDto) {
    const duplicate = await this.prisma.branch.findFirst({
      where: { tenantId: user.tenantId, code: dto.code.trim() },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException("Branch code already exists");
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${user.tenantId}), hashtext('organization-hq'))`;
      if (dto.isHq) await tx.branch.updateMany({ where: { tenantId: user.tenantId }, data: { isHq: false } });
      return tx.branch.create({
        data: {
          tenantId: user.tenantId,
          code: dto.code.trim(),
          nameEn: dto.nameEn.trim(),
          nameKm: dto.nameKm.trim(),
          address: dto.address?.trim() || null,
          timezone: dto.timezone?.trim() || "Asia/Phnom_Penh",
          isHq: dto.isHq ?? false,
        },
      });
    });
  }

  @Post("departments")
  @RequirePermissions("org.write")
  async createDepartment(@CurrentUser() user: AuthPrincipal, @Body() dto: DepartmentDto) {
    const code = dto.code.trim();
    const duplicate = await this.prisma.department.findFirst({
      where: { tenantId: user.tenantId, code },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException("Department code already exists");
    if (dto.parentId) {
      const parent = await this.prisma.department.findFirst({
        where: { id: dto.parentId, tenantId: user.tenantId },
        select: { id: true },
      });
      if (!parent) throw new NotFoundException("Parent department not found in this tenant");
    }
    if (dto.managerId) {
      const manager = await this.prisma.employee.findFirst({
        where: { id: dto.managerId, tenantId: user.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!manager) throw new NotFoundException("Department manager not found in this tenant");
    }
    return this.prisma.department.create({
      data: {
        tenantId: user.tenantId,
        code,
        nameEn: dto.nameEn.trim(),
        nameKm: dto.nameKm.trim(),
        parentId: dto.parentId ?? null,
        managerId: dto.managerId ?? null,
      },
    });
  }

  @Post("positions")
  @RequirePermissions("org.write")
  async createPosition(@CurrentUser() user: AuthPrincipal, @Body() dto: PositionDto) {
    const code = dto.code.trim();
    const duplicate = await this.prisma.position.findFirst({
      where: { tenantId: user.tenantId, code },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException("Position code already exists");
    return this.prisma.position.create({
      data: {
        tenantId: user.tenantId,
        code,
        titleEn: dto.titleEn.trim(),
        titleKm: dto.titleKm.trim(),
        grade: dto.grade?.trim() || null,
      },
    });
  }

  @Post("cost-centers")
  @RequirePermissions("org.write")
  async createCostCenter(@CurrentUser() user: AuthPrincipal, @Body() dto: CostCenterDto) {
    const code = dto.code.trim();
    const duplicate = await this.prisma.costCenter.findFirst({
      where: { tenantId: user.tenantId, code },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException("Cost center code already exists");
    return this.prisma.costCenter.create({
      data: { tenantId: user.tenantId, code, name: dto.name.trim() },
    });
  }

  @Put("branches/:id")
  @RequirePermissions("org.write")
  async updateBranch(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Body() dto: BranchDto) {
    const existing = await this.prisma.branch.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true } });
    if (!existing) throw new NotFoundException("Branch not found");
    const duplicate = await this.prisma.branch.findFirst({ where: { tenantId: user.tenantId, code: dto.code.trim(), id: { not: id } }, select: { id: true } });
    if (duplicate) throw new ConflictException("Branch code already exists");
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${user.tenantId}), hashtext('organization-hq'))`;
      if (dto.isHq) await tx.branch.updateMany({ where: { tenantId: user.tenantId, id: { not: id } }, data: { isHq: false } });
      await tx.branch.updateMany({ where: { id, tenantId: user.tenantId }, data: {
        code: dto.code.trim(), nameEn: dto.nameEn.trim(), nameKm: dto.nameKm.trim(),
        address: dto.address?.trim() || null, timezone: dto.timezone?.trim() || "Asia/Phnom_Penh", isHq: dto.isHq ?? false,
      } });
      return tx.branch.findFirstOrThrow({ where: { id, tenantId: user.tenantId } });
    });
  }

  @Put("departments/:id")
  @RequirePermissions("org.write")
  async updateDepartment(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Body() dto: DepartmentDto) {
    const existing = await this.prisma.department.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true } });
    if (!existing) throw new NotFoundException("Department not found");
    const code = dto.code.trim();
    const duplicate = await this.prisma.department.findFirst({ where: { tenantId: user.tenantId, code, id: { not: id } }, select: { id: true } });
    if (duplicate) throw new ConflictException("Department code already exists");
    if (dto.parentId) {
      let cursor: string | null = dto.parentId;
      const visited = new Set<string>();
      while (cursor) {
        if (cursor === id) throw new ConflictException("A department cannot be nested beneath itself or one of its descendants");
        if (visited.has(cursor)) throw new ConflictException("The existing department hierarchy contains a cycle");
        visited.add(cursor);
        const parent: { id: string; parentId: string | null } | null = await this.prisma.department.findFirst({
          where: { id: cursor, tenantId: user.tenantId }, select: { id: true, parentId: true },
        });
        if (!parent) throw new NotFoundException("Parent department not found in this tenant");
        cursor = parent.parentId;
      }
    }
    if (dto.managerId) {
      const manager = await this.prisma.employee.findFirst({ where: { id: dto.managerId, tenantId: user.tenantId, deletedAt: null }, select: { id: true } });
      if (!manager) throw new NotFoundException("Department manager not found in this tenant");
    }
    const result = await this.prisma.department.updateMany({
      where: { id, tenantId: user.tenantId },
      data: { code, nameEn: dto.nameEn.trim(), nameKm: dto.nameKm.trim(), parentId: dto.parentId ?? null, managerId: dto.managerId ?? null },
    });
    if (!result.count) throw new NotFoundException("Department not found");
    return this.prisma.department.findFirstOrThrow({ where: { id, tenantId: user.tenantId } });
  }

  @Put("positions/:id")
  @RequirePermissions("org.write")
  async updatePosition(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Body() dto: PositionDto) {
    const existing = await this.prisma.position.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true } });
    if (!existing) throw new NotFoundException("Position not found");
    const code = dto.code.trim();
    const duplicate = await this.prisma.position.findFirst({ where: { tenantId: user.tenantId, code, id: { not: id } }, select: { id: true } });
    if (duplicate) throw new ConflictException("Position code already exists");
    const result = await this.prisma.position.updateMany({ where: { id, tenantId: user.tenantId }, data: {
      code, titleEn: dto.titleEn.trim(), titleKm: dto.titleKm.trim(), grade: dto.grade?.trim() || null,
    } });
    if (!result.count) throw new NotFoundException("Position not found");
    return this.prisma.position.findFirstOrThrow({ where: { id, tenantId: user.tenantId } });
  }

  @Put("cost-centers/:id")
  @RequirePermissions("org.write")
  async updateCostCenter(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Body() dto: CostCenterDto) {
    const existing = await this.prisma.costCenter.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true } });
    if (!existing) throw new NotFoundException("Cost center not found");
    const code = dto.code.trim();
    const duplicate = await this.prisma.costCenter.findFirst({ where: { tenantId: user.tenantId, code, id: { not: id } }, select: { id: true } });
    if (duplicate) throw new ConflictException("Cost center code already exists");
    const result = await this.prisma.costCenter.updateMany({ where: { id, tenantId: user.tenantId }, data: { code, name: dto.name.trim() } });
    if (!result.count) throw new NotFoundException("Cost center not found");
    return this.prisma.costCenter.findFirstOrThrow({ where: { id, tenantId: user.tenantId } });
  }
}

@Module({ controllers: [OrganizationController] })
export class OrganizationModule {}
