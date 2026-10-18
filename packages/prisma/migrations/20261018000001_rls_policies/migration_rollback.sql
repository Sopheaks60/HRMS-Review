-- ============================================================================
-- Rollback for PostgreSQL Row Level Security (RLS) Policies
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation ON "Notification";
ALTER TABLE "Notification" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "AuditLog";
ALTER TABLE "AuditLog" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "PayrollItem";
ALTER TABLE "PayrollItem" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "PayrollRun";
ALTER TABLE "PayrollRun" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "PayrollPeriod";
ALTER TABLE "PayrollPeriod" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "OvertimeRequest";
ALTER TABLE "OvertimeRequest" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "OvertimePolicy";
ALTER TABLE "OvertimePolicy" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "LeaveRequest";
ALTER TABLE "LeaveRequest" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "LeaveType";
ALTER TABLE "LeaveType" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "BiometricDevice";
ALTER TABLE "BiometricDevice" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "Attendance";
ALTER TABLE "Attendance" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "Geofence";
ALTER TABLE "Geofence" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "Dependent";
ALTER TABLE "Dependent" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "Contract";
ALTER TABLE "Contract" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "Employee";
ALTER TABLE "Employee" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "CostCenter";
ALTER TABLE "CostCenter" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "Position";
ALTER TABLE "Position" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "Department";
ALTER TABLE "Department" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "Branch";
ALTER TABLE "Branch" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "Role";
ALTER TABLE "Role" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "User";
ALTER TABLE "User" DISABLE ROW LEVEL SECURITY;

DROP FUNCTION IF EXISTS current_tenant_id();

