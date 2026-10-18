import { describe, expect, it, vi } from "vitest";
import { EmployeesController } from "../src/modules/employees/employees.module";

const user = { userId: "user-1", tenantId: "tenant-1", permissions: ["employee.write"] };
const pii = { encrypt: vi.fn((value: string | null | undefined) => value ?? null), decrypt: vi.fn((value: string | null | undefined) => value ?? null) };

describe("EmployeesController", () => {
  it("creates an employee with authenticated tenant ownership and trimmed fields", async () => {
    const created = { id: "employee-1", tenantId: user.tenantId };
    const prisma = {
      branch: { findFirst: vi.fn().mockResolvedValue({ id: "branch-1" }) },
      department: { findFirst: vi.fn().mockResolvedValue({ id: "department-1" }) },
      position: { findFirst: vi.fn().mockResolvedValue({ id: "position-1" }) },
      employee: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(created),
      },
    };
    const controller = new EmployeesController(prisma as never, pii as never);

    await expect(controller.create(user, {
      employeeNo: " E-01 ",
      firstNameEn: " Dara ",
      lastNameEn: " Chan ",
      hireDate: "2026-01-02",
      branchId: "branch-1",
      departmentId: "department-1",
      positionId: "position-1",
    })).resolves.toBe(created);

    expect(prisma.employee.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        employeeNo: "E-01",
        firstNameEn: "Dara",
        lastNameEn: "Chan",
      }),
    }));
  });

  it("rejects organization references outside the current tenant", async () => {
    const prisma = {
      branch: { findFirst: vi.fn().mockResolvedValue(null) },
      department: { findFirst: vi.fn().mockResolvedValue({ id: "department-1" }) },
      position: { findFirst: vi.fn().mockResolvedValue({ id: "position-1" }) },
      employee: { findFirst: vi.fn(), create: vi.fn() },
    };
    const controller = new EmployeesController(prisma as never, pii as never);

    await expect(controller.create(user, {
      employeeNo: "E-01",
      firstNameEn: "Dara",
      lastNameEn: "Chan",
      hireDate: "2026-01-02",
      branchId: "other-tenant-branch",
      departmentId: "department-1",
      positionId: "position-1",
    })).rejects.toThrow("not in this tenant");
    expect(prisma.employee.create).not.toHaveBeenCalled();
  });

  it("does not include encrypted or biometric fields in the employee directory", async () => {
    const prisma = { employee: { findMany: vi.fn().mockResolvedValue([]) } };
    const controller = new EmployeesController(prisma as never, pii as never);
    await controller.list({ ...user, permissions: ["employee.read"] });

    const query = prisma.employee.findMany.mock.calls[0]![0] as { where: object; select: Record<string, unknown> };
    expect(query.where).toEqual({ tenantId: "tenant-1", deletedAt: null });
    expect(query.select).not.toHaveProperty("nationalIdEnc");
    expect(query.select).not.toHaveProperty("bankAccountEnc");
    expect(query.select).not.toHaveProperty("faceTemplateHash");
    expect(query.select).not.toHaveProperty("biometricPin");
  });

  it("keeps encrypted personal data out of the employee self-service profile", async () => {
    const prisma = { employee: { findFirst: vi.fn().mockResolvedValue(null) } };
    const controller = new EmployeesController(prisma as never, pii as never);
    await controller.me({ ...user, employeeId: "employee-1" });

    const query = prisma.employee.findFirst.mock.calls[0]![0] as { select: Record<string, unknown> };
    expect(query.select).not.toHaveProperty("nationalIdEnc");
    expect(query.select).not.toHaveProperty("nssfNumberEnc");
    expect(query.select).not.toHaveProperty("bankAccountEnc");
  });

  it("encrypts sensitive fields before tenant-scoped storage", async () => {
    const employee = { id: "employee-1", nationalIdEnc: "v1.encrypted", nssfNumberEnc: null, bankName: "ABA", bankAccountEnc: "v1.encrypted" };
    const prisma = {
      employee: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirst: vi.fn().mockResolvedValue(employee),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const encryption = { encrypt: vi.fn((value: string | null | undefined) => value?.trim() ? `encrypted:${value.trim()}` : null), decrypt: vi.fn((value: string | null | undefined) => value ?? null) };
    const controller = new EmployeesController(prisma as never, encryption as never);

    await controller.updateMyPersonalData({ ...user, employeeId: "employee-1", permissions: ["employee.pii.self"] }, {
      nationalId: "  N-123  ", nssfNumber: "NSSF-456", bankName: " ABA ", bankAccount: " 001234 ",
    }, { ip: "127.0.0.1", headers: { "user-agent": "test-agent" } } as never);

    expect(prisma.employee.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "employee-1", tenantId: "tenant-1", deletedAt: null },
      data: { nationalIdEnc: "encrypted:N-123", nssfNumberEnc: "encrypted:NSSF-456", bankName: "ABA", bankAccountEnc: "encrypted:001234" },
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "READ_PII", entityId: "employee-1", userAgent: "test-agent" }) }));
  });

  it("does not read contracts when the employee belongs to another tenant", async () => {
    const prisma = {
      employee: { findFirst: vi.fn().mockResolvedValue(null) },
      contract: { findMany: vi.fn() },
    };
    const controller = new EmployeesController(prisma as never, pii as never);

    await expect(controller.contracts(user, "foreign-employee-id")).rejects.toThrow("Employee not found");
    expect(prisma.employee.findFirst).toHaveBeenCalledWith({
      where: { id: "foreign-employee-id", tenantId: user.tenantId, deletedAt: null },
      select: { id: true },
    });
    expect(prisma.contract.findMany).not.toHaveBeenCalled();
  });

  it("terminates the employee and disables their tenant-linked login in one transaction", async () => {
    const tx = {
      employee: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      user: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = {
      $transaction: vi.fn((callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const controller = new EmployeesController(prisma as never, pii as never);

    await expect(controller.terminate(user, "employee-1")).resolves.toMatchObject({
      id: "employee-1",
      status: "TERMINATED",
    });
    expect(tx.employee.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "employee-1", tenantId: "tenant-1", deletedAt: null },
      data: expect.objectContaining({ status: "TERMINATED", deletedAt: expect.any(Date) }),
    }));
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", employeeId: "employee-1", status: { not: "DISABLED" } },
      data: { status: "DISABLED" },
    });
  });
});
