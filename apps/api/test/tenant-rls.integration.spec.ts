import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../src/prisma/prisma.service";

const enabled = process.env.KROMPAY_DATABASE_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const prisma = enabled ? new PrismaService() : null;
const createdTenantIds: string[] = [];

describe.skipIf(!enabled)("PostgreSQL tenant row-level security", () => {
  afterAll(async () => {
    if (!prisma) return;
    if (createdTenantIds.length) await prisma.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
    await prisma.$disconnect();
  });

  it("isolates forced-RLS audit rows by transaction-local tenant context", async () => {
    if (!prisma) throw new Error("Database integration test is not configured");
    const tenantA = await prisma.tenant.create({ data: { slug: `rls-a-${randomUUID()}`, name: "RLS test tenant A" }, select: { id: true } });
    const tenantB = await prisma.tenant.create({ data: { slug: `rls-b-${randomUUID()}`, name: "RLS test tenant B" }, select: { id: true } });
    createdTenantIds.push(tenantA.id, tenantB.id);
    const rowId = randomUUID();

    try {
      await prisma.withTenant(tenantA.id, async (tx) => {
        await tx.auditLog.create({ data: { id: rowId, tenantId: tenantA.id, action: "RLS_TEST", entity: "RlsIntegrationTest" } });
      });
      const withoutContext = await prisma.auditLog.findFirst({ where: { id: rowId }, select: { id: true } });
      const fromTenantA = await prisma.runAsTenant(tenantA.id, () => prisma.auditLog.findFirst({ where: { id: rowId }, select: { id: true } }));
      const fromTenantB = await prisma.runAsTenant(tenantB.id, () => prisma.auditLog.findFirst({ where: { id: rowId }, select: { id: true } }));

      expect(withoutContext).toBeNull();
      expect(fromTenantA?.id).toBe(rowId);
      expect(fromTenantB).toBeNull();
    } finally {
      await prisma.withTenant(tenantA.id, async (tx) => {
        await tx.auditLog.deleteMany({ where: { id: rowId } });
      });
    }
  });
});
