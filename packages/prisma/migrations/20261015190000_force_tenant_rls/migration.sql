-- The API establishes app.tenant_id inside transaction-local Prisma queries.
-- FORCE also applies the policy to the table owner, which is used by local and
-- many managed database deployments unless a separate BYPASSRLS role is used.
ALTER TABLE "Employee" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Attendance" FORCE ROW LEVEL SECURITY;
ALTER TABLE "PayrollRun" FORCE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;
