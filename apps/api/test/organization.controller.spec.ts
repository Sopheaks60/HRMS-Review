import { describe, expect, it, vi } from "vitest";
import { OrganizationController } from "../src/modules/organization/organization.module";

const user = { tenantId: "tenant-1", userId: "user-1", permissions: ["org.write"] } as never;

describe("organization updates", () => {
  it("refuses to update an entity outside the active tenant", async () => {
    const prisma = { branch: { findFirst: vi.fn().mockResolvedValue(null) } };
    const controller = new OrganizationController(prisma as never);
    await expect(controller.updateBranch(user, "foreign-branch", {
      code: "HQ", nameEn: "HQ", nameKm: "HQ",
    } as never)).rejects.toThrow("Branch not found");
    expect(prisma.branch.findFirst).toHaveBeenCalledWith({
      where: { id: "foreign-branch", tenantId: "tenant-1" }, select: { id: true },
    });
  });

  it("rejects a department reparent that would create a cycle", async () => {
    const prisma = {
      department: {
        findFirst: vi.fn()
          .mockResolvedValueOnce({ id: "department-1" })
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: "department-2", parentId: "department-1" }),
      },
    };
    const controller = new OrganizationController(prisma as never);
    await expect(controller.updateDepartment(user, "department-1", {
      code: "ENG", nameEn: "Engineering", nameKm: "Engineering", parentId: "department-2",
    } as never)).rejects.toThrow("cannot be nested beneath itself");
  });

  it("rejects a parent department that belongs to another tenant", async () => {
    const prisma = {
      department: {
        findFirst: vi.fn()
          .mockResolvedValueOnce({ id: "department-1" })
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null),
      },
    };
    const controller = new OrganizationController(prisma as never);
    await expect(controller.updateDepartment(user, "department-1", {
      code: "ENG", nameEn: "Engineering", nameKm: "Engineering", parentId: "foreign-department",
    } as never)).rejects.toThrow("Parent department not found in this tenant");
  });
});
