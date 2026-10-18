import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import { PERMISSIONS, SYSTEM_ROLES } from "../../shared/src/rbac/permissions";
import { CAMBODIA_2026 } from "../../shared/src/payroll/cambodia";

const prisma = new PrismaClient();

async function main() {
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: p,
      create: p,
    });
  }

  await prisma.statutoryTable.create({
    data: {
      country: "KH",
      kind: "TOS_NSSF",
      version: "2026.1",
      effective: new Date("2024-03-11"),
      payload: CAMBODIA_2026 as object,
    },
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      slug: "demo",
      name: "KromPay Demo Co., Ltd.",
      legalName: "KromPay Demo Co., Ltd.",
      status: "ACTIVE",
    },
  });

  const allPerms = await prisma.permission.findMany();
  for (const [code, codes] of Object.entries(SYSTEM_ROLES)) {
    const role = await prisma.role.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code } },
      update: {},
      create: {
        tenantId: tenant.id,
        code,
        nameEn: code,
        nameKm: code,
        isSystem: true,
      },
    });
    const selected = allPerms.filter((p) => (codes as readonly string[]).includes(p.code));
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: selected.map((p) => ({ roleId: role.id, permissionId: p.id })),
    });
  }

  const hash = await argon2.hash("ChangeMe!2026");
  const owner = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "owner@demo.krompay.app" } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "owner@demo.krompay.app",
      passwordHash: hash,
      displayName: "Demo Owner",
      status: "ACTIVE",
    },
  });
  const ownerRole = await prisma.role.findFirst({ where: { tenantId: tenant.id, code: "OWNER" } });
  if (ownerRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: owner.id, roleId: ownerRole.id } },
      update: {},
      create: { userId: owner.id, roleId: ownerRole.id },
    });
  }

  const branch = await prisma.branch.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "HQ" } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: "HQ",
      nameEn: "Phnom Penh HQ",
      nameKm: "ការិយាល័យកណ្តាល ភ្នំពេញ",
      isHq: true,
    },
  });
  const dept = await prisma.department.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "HR" } },
    update: {},
    create: { tenantId: tenant.id, code: "HR", nameEn: "Human Resources", nameKm: "ធនធានមនុស្ស" },
  });
  const pos = await prisma.position.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "HRM" } },
    update: {},
    create: { tenantId: tenant.id, code: "HRM", titleEn: "HR Manager", titleKm: "អ្នកគ្រប់គ្រងធនធានមនុស្ស" },
  });
  await prisma.geofence.createMany({
    data: [
      {
        tenantId: tenant.id,
        branchId: branch.id,
        name: "HQ",
        latitude: 11.5564,
        longitude: 104.9282,
        radiusM: 200,
      },
    ],
    skipDuplicates: true,
  });
  await prisma.leaveType.createMany({
    data: [
      { tenantId: tenant.id, code: "AL", nameEn: "Annual Leave", nameKm: "ច្បាប់ប្រចាំឆ្នាំ", paid: true, annualQuotaDays: 18 },
      { tenantId: tenant.id, code: "SL", nameEn: "Sick Leave", nameKm: "ច្បាប់ឈឺ", paid: true, annualQuotaDays: 6 },
      { tenantId: tenant.id, code: "UL", nameEn: "Unpaid Leave", nameKm: "ច្បាប់គ្មានប្រាក់", paid: false, annualQuotaDays: 0 },
    ],
    skipDuplicates: true,
  });
  await prisma.overtimePolicy.create({
    data: { tenantId: tenant.id },
  });
  console.log({ tenant: tenant.slug, owner: owner.email, org: { branch: branch.code, dept: dept.code, pos: pos.code } });
}

main()
  .finally(() => prisma.$disconnect());
