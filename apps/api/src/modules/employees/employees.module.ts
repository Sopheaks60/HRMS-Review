import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards, Module, BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import type { Request } from "express";
import { EmploymentStatus } from "@prisma/client";
import { IsBoolean, IsDateString, IsEmail, IsIn, IsNumber, IsOptional, IsUUID, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { CurrentUser, type AuthPrincipal } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PrismaService } from "../../prisma/prisma.service";
import { PiiEncryptionService } from "../../common/services/pii-encryption.service";

const EMPLOYEE_DIRECTORY_SELECT = {
  id: true,
  employeeNo: true,
  firstNameEn: true,
  lastNameEn: true,
  firstNameKm: true,
  lastNameKm: true,
  email: true,
  phone: true,
  hireDate: true,
  status: true,
  branchId: true,
  departmentId: true,
  positionId: true,
  costCenterId: true,
  managerId: true,
  branch: { select: { id: true, code: true, nameEn: true, nameKm: true } },
  department: { select: { id: true, code: true, nameEn: true, nameKm: true } },
  position: { select: { id: true, code: true, titleEn: true, titleKm: true, grade: true } },
  costCenter: { select: { id: true, code: true, name: true } },
  manager: { select: { id: true, employeeNo: true, firstNameEn: true, lastNameEn: true } },
} as const;

class CreateEmployeeDto {
  @IsString() @MinLength(1) @MaxLength(32) employeeNo: string;
  @IsString() @MinLength(1) @MaxLength(100) firstNameEn: string;
  @IsString() @MinLength(1) @MaxLength(100) lastNameEn: string;
  @IsDateString() hireDate: string;
  @IsUUID() branchId: string;
  @IsUUID() departmentId: string;
  @IsUUID() positionId: string;
  @IsOptional() @IsUUID() costCenterId?: string;
  @IsOptional() @IsUUID() managerId?: string;
  @IsOptional() @IsString() @MaxLength(100) firstNameKm?: string;
  @IsOptional() @IsString() @MaxLength(100) lastNameKm?: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
}

class UpdateEmployeeDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(32) employeeNo?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) firstNameEn?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) lastNameEn?: string;
  @IsOptional() @IsString() @MaxLength(100) firstNameKm?: string | null;
  @IsOptional() @IsString() @MaxLength(100) lastNameKm?: string | null;
  @IsOptional() @IsDateString() hireDate?: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsUUID() positionId?: string;
  @IsOptional() @IsUUID() costCenterId?: string | null;
  @IsOptional() @IsUUID() managerId?: string | null;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string | null;
  @IsOptional() @IsString() @MaxLength(40) phone?: string | null;
}

class EmployeeStatusDto {
  @IsIn(["PROBATION", "ACTIVE", "SUSPENDED", "RESIGNED"])
  status: "PROBATION" | "ACTIVE" | "SUSPENDED" | "RESIGNED";
}

class CreateContractDto {
  @IsIn(["PERMANENT", "FIXED_TERM", "PROBATION", "INTERN", "CONSULTANT"])
  type: string;
  @IsDateString() startDate: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsIn(["KHR", "USD"]) currency: string;
  @IsNumber() @Min(0.01) basicSalary: number;
  @IsOptional() @IsNumber() @Min(1) @Max(31) workingDays?: number;
  @IsOptional() @IsNumber() @Min(0.25) @Max(24) hoursPerDay?: number;
  @IsOptional() allowances?: { code: string; amount: number }[];
  @IsOptional() @IsUUID() fileId?: string;
}

class CreateDependentDto {
  @IsIn(["spouse", "child", "other"]) relationship: string;
  @IsString() @MinLength(1) @MaxLength(150) fullName: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsBoolean() qualifiesTos?: boolean;
}

class EmployeePiiDto {
  @IsOptional() @IsString() @MaxLength(80) nationalId?: string | null;
  @IsOptional() @IsString() @MaxLength(80) nssfNumber?: string | null;
  @IsOptional() @IsString() @MaxLength(120) bankName?: string | null;
  @IsOptional() @IsString() @MaxLength(100) bankAccount?: string | null;
}

@Controller("employees")
@UseGuards(PermissionsGuard)
export class EmployeesController {
  constructor(private readonly prisma: PrismaService, private readonly pii: PiiEncryptionService) {}

  @Get()
  @RequirePermissions("employee.read")
  list(@CurrentUser() user: AuthPrincipal) {
    return this.prisma.employee.findMany({
      where: { tenantId: user.tenantId, deletedAt: null },
      select: EMPLOYEE_DIRECTORY_SELECT,
      take: 500,
    });
  }

  @Get("me")
  me(@CurrentUser() user: AuthPrincipal) {
    return this.prisma.employee.findFirst({
      where: { id: user.employeeId, tenantId: user.tenantId, deletedAt: null },
      select: {
        ...EMPLOYEE_DIRECTORY_SELECT,
        gender: true,
        dateOfBirth: true,
        nationality: true,
        maritalStatus: true,
        taxResidency: true,
        contracts: true,
        dependents: true,
      },
    });
  }

  @Get("me/personal-data")
  @RequirePermissions("employee.pii.self")
  async myPersonalData(@CurrentUser() user: AuthPrincipal, @Req() request: Request) {
    if (!user.employeeId) throw new NotFoundException("Employee profile is not linked");
    await this.auditPiiRead(user, user.employeeId, request);
    return this.readPersonalData(user.tenantId, user.employeeId);
  }

  @Patch("me/personal-data")
  @RequirePermissions("employee.pii.self")
  async updateMyPersonalData(@CurrentUser() user: AuthPrincipal, @Body() dto: EmployeePiiDto, @Req() request: Request) {
    if (!user.employeeId) throw new NotFoundException("Employee profile is not linked");
    await this.writePersonalData(user.tenantId, user.employeeId, dto);
    await this.auditPiiRead(user, user.employeeId, request);
    return this.readPersonalData(user.tenantId, user.employeeId);
  }

  @Get(":id/personal-data")
  @RequirePermissions("employee.pii.read")
  async personalData(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Req() request: Request) {
    await this.auditPiiRead(user, id, request);
    return this.readPersonalData(user.tenantId, id);
  }

  @Patch(":id/personal-data")
  @RequirePermissions("employee.pii.write")
  async updatePersonalData(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Body() dto: EmployeePiiDto, @Req() request: Request) {
    await this.writePersonalData(user.tenantId, id, dto);
    await this.auditPiiRead(user, id, request);
    return this.readPersonalData(user.tenantId, id);
  }

  private async auditPiiRead(user: AuthPrincipal, employeeId: string, request: Request) {
    await this.prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.userId,
        action: "READ_PII",
        entity: "Employee",
        entityId: employeeId,
        ip: request.ip,
        userAgent: request.headers["user-agent"],
      },
    });
  }

  private async readPersonalData(tenantId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId, deletedAt: null },
      select: { id: true, nationalIdEnc: true, nssfNumberEnc: true, bankName: true, bankAccountEnc: true },
    });
    if (!employee) throw new NotFoundException("Employee not found");
    return {
      employeeId: employee.id,
      nationalId: this.pii.decrypt(employee.nationalIdEnc),
      nssfNumber: this.pii.decrypt(employee.nssfNumberEnc),
      bankName: employee.bankName,
      bankAccount: this.pii.decrypt(employee.bankAccountEnc),
    };
  }

  private async writePersonalData(tenantId: string, employeeId: string, dto: EmployeePiiDto) {
    const data = {
      ...(dto.nationalId !== undefined ? { nationalIdEnc: this.pii.encrypt(dto.nationalId) } : {}),
      ...(dto.nssfNumber !== undefined ? { nssfNumberEnc: this.pii.encrypt(dto.nssfNumber) } : {}),
      ...(dto.bankName !== undefined ? { bankName: dto.bankName?.trim() || null } : {}),
      ...(dto.bankAccount !== undefined ? { bankAccountEnc: this.pii.encrypt(dto.bankAccount) } : {}),
    };
    if (!Object.keys(data).length) throw new BadRequestException("Provide at least one personal-data field");
    const updated = await this.prisma.employee.updateMany({ where: { id: employeeId, tenantId, deletedAt: null }, data });
    if (!updated.count) throw new NotFoundException("Employee not found");
  }

  @Get("me/contracts")
  myContracts(@CurrentUser() user: AuthPrincipal) {
    return this.prisma.contract.findMany({ where: { employee: { id: user.employeeId, tenantId: user.tenantId } }, orderBy: { startDate: "desc" } });
  }

  @Get("me/dependents")
  myDependents(@CurrentUser() user: AuthPrincipal) {
    return this.prisma.dependent.findMany({ where: { employee: { id: user.employeeId, tenantId: user.tenantId } }, orderBy: { fullName: "asc" } });
  }

  @Get(":id/contracts")
  @RequirePermissions("employee.write")
  async contracts(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) {
    await this.requireEmployee(user.tenantId, id);
    return this.prisma.contract.findMany({ where: { employeeId: id }, orderBy: { startDate: "desc" } });
  }

  @Post(":id/contracts")
  @RequirePermissions("employee.write")
  async addContract(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Body() dto: CreateContractDto) {
    const employee = await this.prisma.employee.findFirst({ where: { id, tenantId: user.tenantId, deletedAt: null }, select: { id: true, hireDate: true } });
    if (!employee) throw new NotFoundException("Employee not found");
    const startDate = new Date(`${dto.startDate.slice(0, 10)}T00:00:00.000Z`);
    const endDate = dto.endDate ? new Date(`${dto.endDate.slice(0, 10)}T00:00:00.000Z`) : null;
    if (startDate < employee.hireDate || (endDate && endDate < startDate)) throw new BadRequestException("Contract dates are invalid");
    if (!Array.isArray(dto.allowances ?? []) || (dto.allowances ?? []).some(a => !a || typeof a.code !== "string" || !a.code.trim() || !Number.isFinite(a.amount) || a.amount < 0)) throw new BadRequestException("Allowances must have a code and non-negative amount");
    if (dto.fileId && !(await this.prisma.storedFile.findFirst({ where: { id: dto.fileId, tenantId: user.tenantId } }))) throw new NotFoundException("Contract file not found in this tenant");
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${id}), hashtext('contract'))`;
      const latest = await tx.contract.findFirst({ where: { employeeId: id }, orderBy: { startDate: "desc" } });
      if (latest && (startDate.getUTCDate() !== 1 || startDate <= latest.startDate)) throw new BadRequestException("Contract changes must start on the first day of a month and after the previous contract");
      if (latest) await tx.contract.update({ where: { id: latest.id }, data: { endDate: new Date(startDate.getTime() - 86400000), isCurrent: false } });
      return tx.contract.create({ data: { employeeId: id, type: dto.type, startDate, endDate, currency: dto.currency, basicSalary: dto.basicSalary, workingDays: dto.workingDays ?? 26, hoursPerDay: dto.hoursPerDay ?? 8, allowances: dto.allowances ?? [], fileId: dto.fileId ?? null, isCurrent: true } });
    });
  }

  @Get(":id/dependents")
  @RequirePermissions("employee.write")
  async dependents(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) {
    await this.requireEmployee(user.tenantId, id);
    return this.prisma.dependent.findMany({ where: { employeeId: id }, orderBy: { fullName: "asc" } });
  }

  @Post(":id/dependents")
  @RequirePermissions("employee.write")
  async addDependent(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Body() dto: CreateDependentDto) {
    await this.requireEmployee(user.tenantId, id);
    return this.prisma.dependent.create({ data: { employeeId: id, relationship: dto.relationship, fullName: dto.fullName.trim(), dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null, qualifiesTos: dto.qualifiesTos ?? true } });
  }

  @Patch(":id/dependents/:dependentId")
  @RequirePermissions("employee.write")
  async updateDependent(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Param("dependentId") dependentId: string, @Body() dto: CreateDependentDto) {
    await this.requireEmployee(user.tenantId, id);
    const result = await this.prisma.dependent.updateMany({ where: { id: dependentId, employeeId: id }, data: { relationship: dto.relationship, fullName: dto.fullName.trim(), dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null, qualifiesTos: dto.qualifiesTos ?? true } });
    if (!result.count) throw new NotFoundException("Dependent not found");
    return this.prisma.dependent.findFirstOrThrow({ where: { id: dependentId, employeeId: id } });
  }

  private async requireEmployee(tenantId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({ where: { id, tenantId, deletedAt: null }, select: { id: true } });
    if (!employee) throw new NotFoundException("Employee not found");
    return employee;
  }

  @Get("me/payslips")
  myPayslips(@CurrentUser() user: AuthPrincipal) {
    if (!user.employeeId) return [];
    return this.prisma.payrollItem.findMany({
      where: {
        employeeId: user.employeeId,
        run: { tenantId: user.tenantId, status: { in: ["APPROVED", "PAID"] } },
      },
      select: {
        id: true,
        gross: true,
        tosAmount: true,
        nssfPensionEe: true,
        net: true,
        payslipFileId: true,
        run: { select: { period: { select: { year: true, month: true } }, status: true } },
      },
      orderBy: { run: { period: { year: "desc" } } },
    });
  }

  @Get(":id")
  @RequirePermissions("employee.read")
  get(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) {
    return this.prisma.employee.findFirst({
      where: { id, tenantId: user.tenantId, deletedAt: null },
      select: EMPLOYEE_DIRECTORY_SELECT,
    });
  }

  @Post()
  @RequirePermissions("employee.write")
  async create(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateEmployeeDto) {
    const [branch, department, position, costCenter, manager] = await Promise.all([
      this.prisma.branch.findFirst({ where: { id: dto.branchId, tenantId: user.tenantId } }),
      this.prisma.department.findFirst({ where: { id: dto.departmentId, tenantId: user.tenantId } }),
      this.prisma.position.findFirst({ where: { id: dto.positionId, tenantId: user.tenantId } }),
      dto.costCenterId ? this.prisma.costCenter.findFirst({ where: { id: dto.costCenterId, tenantId: user.tenantId } }) : null,
      dto.managerId ? this.prisma.employee.findFirst({ where: { id: dto.managerId, tenantId: user.tenantId, deletedAt: null } }) : null,
    ]);
    if (!branch || !department || !position || (dto.costCenterId && !costCenter) || (dto.managerId && !manager)) {
      throw new NotFoundException("Branch, department, or position is not in this tenant");
    }
    const duplicate = await this.prisma.employee.findFirst({
      where: { tenantId: user.tenantId, employeeNo: dto.employeeNo.trim() },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException("Employee number already exists");
    return this.prisma.employee.create({
      data: {
        tenantId: user.tenantId,
        employeeNo: dto.employeeNo.trim(),
        firstNameEn: dto.firstNameEn.trim(),
        lastNameEn: dto.lastNameEn.trim(),
        firstNameKm: dto.firstNameKm?.trim() || null,
        lastNameKm: dto.lastNameKm?.trim() || null,
        email: dto.email?.trim().toLowerCase() || null,
        phone: dto.phone?.trim() || null,
        hireDate: new Date(dto.hireDate),
        branchId: dto.branchId,
        departmentId: dto.departmentId,
        positionId: dto.positionId,
        costCenterId: dto.costCenterId ?? null,
        managerId: dto.managerId ?? null,
      },
      select: EMPLOYEE_DIRECTORY_SELECT,
    });
  }

  @Patch(":id")
  @RequirePermissions("employee.write")
  async update(
    @CurrentUser() user: AuthPrincipal,
    @Param("id") id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    const current = await this.prisma.employee.findFirst({
      where: { id, tenantId: user.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!current) throw new NotFoundException("Employee not found");

    if (dto.employeeNo) {
      const duplicate = await this.prisma.employee.findFirst({
        where: { tenantId: user.tenantId, employeeNo: dto.employeeNo.trim(), id: { not: id } },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException("Employee number already exists");
    }
    if (dto.branchId && !(await this.prisma.branch.findFirst({ where: { id: dto.branchId, tenantId: user.tenantId } }))) {
      throw new NotFoundException("Branch not found in this tenant");
    }
    if (dto.departmentId && !(await this.prisma.department.findFirst({ where: { id: dto.departmentId, tenantId: user.tenantId } }))) {
      throw new NotFoundException("Department not found in this tenant");
    }
    if (dto.positionId && !(await this.prisma.position.findFirst({ where: { id: dto.positionId, tenantId: user.tenantId } }))) {
      throw new NotFoundException("Position not found in this tenant");
    }
    if (dto.costCenterId && !(await this.prisma.costCenter.findFirst({ where: { id: dto.costCenterId, tenantId: user.tenantId } }))) {
      throw new NotFoundException("Cost center not found in this tenant");
    }
    if (dto.managerId && (dto.managerId === id || !(await this.prisma.employee.findFirst({ where: { id: dto.managerId, tenantId: user.tenantId, deletedAt: null } })))) {
      throw new BadRequestException("Manager must be another active employee in this tenant");
    }

    const data = {
      ...(dto.employeeNo !== undefined ? { employeeNo: dto.employeeNo.trim() } : {}),
      ...(dto.firstNameEn !== undefined ? { firstNameEn: dto.firstNameEn.trim() } : {}),
      ...(dto.lastNameEn !== undefined ? { lastNameEn: dto.lastNameEn.trim() } : {}),
      ...(dto.firstNameKm !== undefined ? { firstNameKm: dto.firstNameKm?.trim() || null } : {}),
      ...(dto.lastNameKm !== undefined ? { lastNameKm: dto.lastNameKm?.trim() || null } : {}),
      ...(dto.hireDate !== undefined ? { hireDate: new Date(dto.hireDate) } : {}),
      ...(dto.branchId !== undefined ? { branchId: dto.branchId } : {}),
      ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId } : {}),
      ...(dto.positionId !== undefined ? { positionId: dto.positionId } : {}),
      ...(dto.costCenterId !== undefined ? { costCenterId: dto.costCenterId } : {}),
      ...(dto.managerId !== undefined ? { managerId: dto.managerId } : {}),
      ...(dto.email !== undefined ? { email: dto.email?.trim().toLowerCase() || null } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
    };
    const updated = await this.prisma.employee.updateMany({
      where: { id, tenantId: user.tenantId, deletedAt: null },
      data,
    });
    if (!updated.count) throw new NotFoundException("Employee not found");
    return this.prisma.employee.findFirstOrThrow({
      where: { id, tenantId: user.tenantId, deletedAt: null },
      select: EMPLOYEE_DIRECTORY_SELECT,
    });
  }

  @Patch(":id/status")
  @RequirePermissions("employee.write")
  async updateStatus(
    @CurrentUser() user: AuthPrincipal,
    @Param("id") id: string,
    @Body() dto: EmployeeStatusDto,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.employee.updateMany({
        where: { id, tenantId: user.tenantId, deletedAt: null },
        data: {
          status: dto.status as EmploymentStatus,
          ...(dto.status === "RESIGNED" ? { terminateDate: new Date() } : {}),
        },
      });
      if (!updated.count) throw new NotFoundException("Employee not found");
      if (dto.status === "RESIGNED") {
        await tx.user.updateMany({
          where: { tenantId: user.tenantId, employeeId: id, status: { not: "DISABLED" } },
          data: { status: "DISABLED" },
        });
      }
    });
    return this.prisma.employee.findFirstOrThrow({ where: { id, tenantId: user.tenantId, deletedAt: null }, select: EMPLOYEE_DIRECTORY_SELECT });
  }

  @Delete(":id")
  @RequirePermissions("employee.write")
  async terminate(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) {
    if (user.employeeId === id) throw new BadRequestException("You cannot terminate your own employee record");
    const terminatedAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.employee.updateMany({
        where: { id, tenantId: user.tenantId, deletedAt: null },
        data: { status: "TERMINATED", terminateDate: terminatedAt, deletedAt: terminatedAt },
      });
      if (!result.count) throw new NotFoundException("Employee not found or already terminated");
      await tx.user.updateMany({
        where: { tenantId: user.tenantId, employeeId: id, status: { not: "DISABLED" } },
        data: { status: "DISABLED" },
      });
      return { id, status: "TERMINATED", terminatedAt };
    });
  }
}

@Module({ controllers: [EmployeesController], providers: [PiiEncryptionService] })
export class EmployeesModule {}
