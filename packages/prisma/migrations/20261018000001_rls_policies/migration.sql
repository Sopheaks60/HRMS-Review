-- ============================================================================
-- PostgreSQL Row Level Security (RLS) Policies for KromPay Multi-Tenant SaaS
-- Tenant Context: app.tenant_id (set via PrismaService $transaction / runAsTenant)
-- ============================================================================

-- Function to safely obtain current tenant_id setting
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid AS $$
BEGIN
  RETURN NULLIF(current_setting('app.tenant_id', true), '')::uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- ----------------------------------------------------------------------------
-- 1. Identity & RBAC
-- ----------------------------------------------------------------------------

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "User";
CREATE POLICY tenant_isolation ON "User"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING ("tenantId" = current_tenant_id());

ALTER TABLE "Role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Role" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Role";
CREATE POLICY tenant_isolation ON "Role"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING ("tenantId" = current_tenant_id());

-- ----------------------------------------------------------------------------
-- 2. Organization Structure
-- ----------------------------------------------------------------------------

ALTER TABLE "Branch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Branch" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Branch";
CREATE POLICY tenant_isolation ON "Branch"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING ("tenantId" = current_tenant_id());

ALTER TABLE "Department" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Department" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Department";
CREATE POLICY tenant_isolation ON "Department"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING ("tenantId" = current_tenant_id());

ALTER TABLE "Position" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Position" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Position";
CREATE POLICY tenant_isolation ON "Position"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING ("tenantId" = current_tenant_id());

ALTER TABLE "CostCenter" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CostCenter" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "CostCenter";
CREATE POLICY tenant_isolation ON "CostCenter"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING ("tenantId" = current_tenant_id());

-- ----------------------------------------------------------------------------
-- 3. Employees, Contracts, Dependents
-- ----------------------------------------------------------------------------

ALTER TABLE "Employee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Employee" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Employee";
CREATE POLICY tenant_isolation ON "Employee"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING ("tenantId" = current_tenant_id());

ALTER TABLE "Contract" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Contract" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Contract";
CREATE POLICY tenant_isolation ON "Contract"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (EXISTS (
    SELECT 1 FROM "Employee" e
    WHERE e.id = "Contract"."employeeId"
      AND e."tenantId" = current_tenant_id()
  ));

ALTER TABLE "Dependent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Dependent" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Dependent";
CREATE POLICY tenant_isolation ON "Dependent"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (EXISTS (
    SELECT 1 FROM "Employee" e
    WHERE e.id = "Dependent"."employeeId"
      AND e."tenantId" = current_tenant_id()
  ));

-- ----------------------------------------------------------------------------
-- 4. Attendance, GPS, Biometrics
-- ----------------------------------------------------------------------------

ALTER TABLE "Geofence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Geofence" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Geofence";
CREATE POLICY tenant_isolation ON "Geofence"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING ("tenantId" = current_tenant_id());

ALTER TABLE "Attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Attendance" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Attendance";
CREATE POLICY tenant_isolation ON "Attendance"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING ("tenantId" = current_tenant_id());

ALTER TABLE "BiometricDevice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BiometricDevice" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "BiometricDevice";
CREATE POLICY tenant_isolation ON "BiometricDevice"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING ("tenantId" = current_tenant_id());

-- ----------------------------------------------------------------------------
-- 5. Leave & Overtime
-- ----------------------------------------------------------------------------

ALTER TABLE "LeaveType" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveType" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "LeaveType";
CREATE POLICY tenant_isolation ON "LeaveType"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING ("tenantId" = current_tenant_id());

ALTER TABLE "LeaveRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveRequest" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "LeaveRequest";
CREATE POLICY tenant_isolation ON "LeaveRequest"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING ("tenantId" = current_tenant_id());

ALTER TABLE "OvertimePolicy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OvertimePolicy" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "OvertimePolicy";
CREATE POLICY tenant_isolation ON "OvertimePolicy"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING ("tenantId" = current_tenant_id());

ALTER TABLE "OvertimeRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OvertimeRequest" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "OvertimeRequest";
CREATE POLICY tenant_isolation ON "OvertimeRequest"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING ("tenantId" = current_tenant_id());

-- ----------------------------------------------------------------------------
-- 6. Payroll Core
-- ----------------------------------------------------------------------------

ALTER TABLE "PayrollPeriod" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PayrollPeriod" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "PayrollPeriod";
CREATE POLICY tenant_isolation ON "PayrollPeriod"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING ("tenantId" = current_tenant_id());

ALTER TABLE "PayrollRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PayrollRun" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "PayrollRun";
CREATE POLICY tenant_isolation ON "PayrollRun"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING ("tenantId" = current_tenant_id());

ALTER TABLE "PayrollItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PayrollItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "PayrollItem";
CREATE POLICY tenant_isolation ON "PayrollItem"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (EXISTS (
    SELECT 1 FROM "PayrollRun" r
    WHERE r.id = "PayrollItem"."runId"
      AND r."tenantId" = current_tenant_id()
  ));

-- ----------------------------------------------------------------------------
-- 7. Audit & Notifications
-- ----------------------------------------------------------------------------

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AuditLog";
CREATE POLICY tenant_isolation ON "AuditLog"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING ("tenantId" = current_tenant_id());

ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Notification";
CREATE POLICY tenant_isolation ON "Notification"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING ("tenantId" = current_tenant_id());

