-- KromPay initial schema (PostgreSQL 16+)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE "TenantStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED');
CREATE TYPE "PlanCode" AS ENUM ('STARTER', 'PROFESSIONAL', 'ENTERPRISE');
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'LOCKED', 'DISABLED');
CREATE TYPE "EmploymentStatus" AS ENUM ('PROBATION', 'ACTIVE', 'SUSPENDED', 'TERMINATED', 'RESIGNED');
CREATE TYPE "TaxResidency" AS ENUM ('RESIDENT', 'NON_RESIDENT');
CREATE TYPE "AttendanceSource" AS ENUM ('WEB', 'GPS', 'FACE', 'BIOMETRIC', 'MANUAL');
CREATE TYPE "AttendanceType" AS ENUM ('CLOCK_IN', 'CLOCK_OUT', 'BREAK_START', 'BREAK_END');
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'PAID');
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'CALCULATED', 'PENDING_APPROVAL', 'APPROVED', 'PAID', 'VOID');

CREATE TABLE "Tenant" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "legalName" TEXT,
  "taxId" TEXT,
  "nssfEmployerNo" TEXT,
  "status" "TenantStatus" NOT NULL DEFAULT 'TRIAL',
  "locale" TEXT NOT NULL DEFAULT 'km',
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Phnom_Penh',
  "currency" TEXT NOT NULL DEFAULT 'KHR',
  "country" TEXT NOT NULL DEFAULT 'KH',
  "logoFileId" UUID,
  "settings" JSONB NOT NULL DEFAULT '{}',
  "trialEndsAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deletedAt" TIMESTAMPTZ
);

CREATE TABLE "FeatureFlag" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "key" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("tenantId", "key")
);

CREATE TABLE "Subscription" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "plan" "PlanCode" NOT NULL,
  "seats" INTEGER NOT NULL,
  "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
  "provider" TEXT NOT NULL DEFAULT 'stripe',
  "providerCustomerId" TEXT,
  "providerSubId" TEXT,
  "currentPeriodStart" TIMESTAMPTZ NOT NULL,
  "currentPeriodEnd" TIMESTAMPTZ NOT NULL,
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "Invoice" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "number" TEXT NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" TEXT NOT NULL,
  "issuedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "paidAt" TIMESTAMPTZ,
  "providerRef" TEXT,
  "pdfFileId" UUID,
  UNIQUE ("tenantId", "number")
);

CREATE TABLE "User" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "locale" TEXT NOT NULL DEFAULT 'en',
  "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
  "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
  "mfaSecretEnc" TEXT,
  "lastLoginAt" TIMESTAMPTZ,
  "failedLogins" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMPTZ,
  "employeeId" UUID UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deletedAt" TIMESTAMPTZ,
  UNIQUE ("tenantId", "email")
);

CREATE TABLE "Session" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "ip" TEXT,
  "userAgent" TEXT,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "RefreshToken" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "revokedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "PushToken" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "platform" TEXT NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "Role" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "code" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "nameKm" TEXT NOT NULL,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  UNIQUE ("tenantId", "code")
);

CREATE TABLE "Permission" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL UNIQUE,
  "module" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "nameKm" TEXT NOT NULL
);

CREATE TABLE "RolePermission" (
  "roleId" UUID NOT NULL REFERENCES "Role"("id") ON DELETE CASCADE,
  "permissionId" UUID NOT NULL REFERENCES "Permission"("id") ON DELETE CASCADE,
  PRIMARY KEY ("roleId", "permissionId")
);

CREATE TABLE "UserRole" (
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "roleId" UUID NOT NULL REFERENCES "Role"("id") ON DELETE CASCADE,
  "assignedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY ("userId", "roleId")
);

CREATE TABLE "Branch" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "code" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "nameKm" TEXT NOT NULL,
  "address" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Phnom_Penh',
  "isHq" BOOLEAN NOT NULL DEFAULT false,
  UNIQUE ("tenantId", "code")
);

CREATE TABLE "Department" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "parentId" UUID REFERENCES "Department"("id"),
  "code" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "nameKm" TEXT NOT NULL,
  "managerId" UUID,
  UNIQUE ("tenantId", "code")
);

CREATE TABLE "Position" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "code" TEXT NOT NULL,
  "titleEn" TEXT NOT NULL,
  "titleKm" TEXT NOT NULL,
  "grade" TEXT,
  UNIQUE ("tenantId", "code")
);

CREATE TABLE "CostCenter" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  UNIQUE ("tenantId", "code")
);

CREATE TABLE "Employee" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "employeeNo" TEXT NOT NULL,
  "firstNameEn" TEXT NOT NULL,
  "lastNameEn" TEXT NOT NULL,
  "firstNameKm" TEXT,
  "lastNameKm" TEXT,
  "gender" TEXT,
  "dateOfBirth" DATE,
  "nationality" TEXT DEFAULT 'KH',
  "nationalIdEnc" TEXT,
  "nssfNumber" TEXT,
  "taxResidency" "TaxResidency" NOT NULL DEFAULT 'RESIDENT',
  "maritalStatus" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "hireDate" DATE NOT NULL,
  "probationEnd" DATE,
  "terminateDate" DATE,
  "status" "EmploymentStatus" NOT NULL DEFAULT 'PROBATION',
  "branchId" UUID NOT NULL REFERENCES "Branch"("id"),
  "departmentId" UUID NOT NULL REFERENCES "Department"("id"),
  "positionId" UUID NOT NULL REFERENCES "Position"("id"),
  "costCenterId" UUID REFERENCES "CostCenter"("id"),
  "managerId" UUID REFERENCES "Employee"("id"),
  "bankName" TEXT,
  "bankAccountEnc" TEXT,
  "faceTemplateHash" TEXT,
  "biometricPin" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deletedAt" TIMESTAMPTZ,
  UNIQUE ("tenantId", "employeeNo")
);

CREATE TABLE "Contract" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "employeeId" UUID NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE,
  "type" TEXT NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE,
  "currency" TEXT NOT NULL DEFAULT 'KHR',
  "basicSalary" DECIMAL(18,2) NOT NULL,
  "workingDays" INTEGER NOT NULL DEFAULT 26,
  "hoursPerDay" DECIMAL(4,2) NOT NULL DEFAULT 8,
  "allowances" JSONB NOT NULL DEFAULT '[]',
  "fileId" UUID,
  "isCurrent" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE "Dependent" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "employeeId" UUID NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE,
  "relationship" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "dateOfBirth" DATE,
  "qualifiesTos" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE "Geofence" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "branchId" UUID REFERENCES "Branch"("id"),
  "name" TEXT NOT NULL,
  "latitude" DECIMAL(10,7) NOT NULL,
  "longitude" DECIMAL(10,7) NOT NULL,
  "radiusM" INTEGER NOT NULL DEFAULT 150,
  "active" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE "Attendance" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "employeeId" UUID NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE,
  "type" "AttendanceType" NOT NULL,
  "source" "AttendanceSource" NOT NULL,
  "punchedAt" TIMESTAMPTZ NOT NULL,
  "workDate" DATE NOT NULL,
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "accuracyM" DECIMAL(8,2),
  "geofenceId" UUID,
  "insideFence" BOOLEAN,
  "deviceId" UUID,
  "selfieId" UUID,
  "livenessScore" DECIMAL(5,4),
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "Attendance_employee_workDate_idx" ON "Attendance" ("employeeId", "workDate");
CREATE INDEX "Attendance_tenant_punched_idx" ON "Attendance" ("tenantId", "punchedAt");

CREATE TABLE "FaceSelfie" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "employeeId" UUID NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE,
  "fileId" UUID NOT NULL,
  "embedding" JSONB,
  "matchScore" DECIMAL(5,4),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "BiometricDevice" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "branchId" UUID REFERENCES "Branch"("id"),
  "vendor" TEXT NOT NULL DEFAULT 'ZKTeco',
  "serialNo" TEXT NOT NULL,
  "model" TEXT,
  "ipAddress" TEXT,
  "lastSeenAt" TIMESTAMPTZ,
  "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
  UNIQUE ("tenantId", "serialNo")
);

CREATE TABLE "BiometricPunch" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "deviceId" UUID NOT NULL REFERENCES "BiometricDevice"("id") ON DELETE CASCADE,
  "pin" TEXT NOT NULL,
  "punchedAt" TIMESTAMPTZ NOT NULL,
  "verifyMode" INTEGER,
  "raw" JSONB,
  "ingestedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "attendanceId" UUID,
  UNIQUE ("deviceId", "pin", "punchedAt")
);

CREATE TABLE "LeaveType" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "nameKm" TEXT NOT NULL,
  "paid" BOOLEAN NOT NULL DEFAULT true,
  "annualQuotaDays" DECIMAL(6,2) NOT NULL,
  "gender" TEXT,
  UNIQUE ("tenantId", "code")
);

CREATE TABLE "LeaveBalance" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "employeeId" UUID NOT NULL,
  "leaveTypeId" UUID NOT NULL,
  "year" INTEGER NOT NULL,
  "entitled" DECIMAL(6,2) NOT NULL,
  "used" DECIMAL(6,2) NOT NULL DEFAULT 0,
  "pending" DECIMAL(6,2) NOT NULL DEFAULT 0,
  UNIQUE ("employeeId", "leaveTypeId", "year")
);

CREATE TABLE "LeaveRequest" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "employeeId" UUID NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE,
  "leaveTypeId" UUID NOT NULL REFERENCES "LeaveType"("id"),
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "days" DECIMAL(6,2) NOT NULL,
  "reason" TEXT,
  "status" "WorkflowStatus" NOT NULL DEFAULT 'SUBMITTED',
  "approverId" UUID,
  "decidedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "OvertimePolicy" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "weekdayRate" DECIMAL(4,2) NOT NULL DEFAULT 1.50,
  "nightRate" DECIMAL(4,2) NOT NULL DEFAULT 2.00,
  "restDayRate" DECIMAL(4,2) NOT NULL DEFAULT 2.00,
  "holidayRate" DECIMAL(4,2) NOT NULL DEFAULT 2.00,
  "maxHoursMonth" DECIMAL(6,2) NOT NULL DEFAULT 54
);

CREATE TABLE "OvertimeRequest" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "employeeId" UUID NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE,
  "workDate" DATE NOT NULL,
  "hours" DECIMAL(6,2) NOT NULL,
  "otType" TEXT NOT NULL,
  "reason" TEXT,
  "status" "WorkflowStatus" NOT NULL DEFAULT 'SUBMITTED',
  "approverId" UUID,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "StatutoryTable" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "country" TEXT NOT NULL DEFAULT 'KH',
  "kind" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "effective" DATE NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "PayrollPeriod" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  UNIQUE ("tenantId", "year", "month")
);

CREATE TABLE "PayrollRun" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "periodId" UUID NOT NULL REFERENCES "PayrollPeriod"("id"),
  "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
  "currency" TEXT NOT NULL DEFAULT 'KHR',
  "fxUsdKhr" DECIMAL(12,4) NOT NULL DEFAULT 4100,
  "submittedBy" UUID,
  "approvedBy" UUID,
  "approvedAt" TIMESTAMPTZ,
  "paidAt" TIMESTAMPTZ,
  "totalGross" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "totalNet" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "totalTos" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "totalNssfEe" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "totalNssfEr" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "PayrollItem" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "runId" UUID NOT NULL REFERENCES "PayrollRun"("id") ON DELETE CASCADE,
  "employeeId" UUID NOT NULL REFERENCES "Employee"("id"),
  "basic" DECIMAL(18,2) NOT NULL,
  "allowances" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "overtime" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "unpaidLeave" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "fringeBenefits" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "gross" DECIMAL(18,2) NOT NULL,
  "tosBase" DECIMAL(18,2) NOT NULL,
  "tosAmount" DECIMAL(18,2) NOT NULL,
  "fringeTax" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "nssfWage" DECIMAL(18,2) NOT NULL,
  "nssfPensionEe" DECIMAL(18,2) NOT NULL,
  "nssfPensionEr" DECIMAL(18,2) NOT NULL,
  "nssfHealthEr" DECIMAL(18,2) NOT NULL,
  "nssfRiskEr" DECIMAL(18,2) NOT NULL,
  "otherDeductions" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "net" DECIMAL(18,2) NOT NULL,
  "breakdown" JSONB NOT NULL,
  "payslipFileId" UUID,
  UNIQUE ("runId", "employeeId")
);

CREATE TABLE "Payslip" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "itemId" UUID NOT NULL UNIQUE,
  "fileId" UUID NOT NULL,
  "sentAt" TIMESTAMPTZ,
  "viewedAt" TIMESTAMPTZ
);

CREATE TABLE "JobRequisition" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "titleEn" TEXT NOT NULL,
  "titleKm" TEXT NOT NULL,
  "departmentId" UUID,
  "status" TEXT NOT NULL DEFAULT 'open',
  "headcount" INTEGER NOT NULL DEFAULT 1,
  "description" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "Candidate" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "fullName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "resumeId" UUID,
  "source" TEXT
);

CREATE TABLE "Application" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "jobId" UUID NOT NULL REFERENCES "JobRequisition"("id") ON DELETE CASCADE,
  "candidateId" UUID NOT NULL REFERENCES "Candidate"("id") ON DELETE CASCADE,
  "stage" TEXT NOT NULL DEFAULT 'applied',
  "score" INTEGER,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "Interview" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "applicationId" UUID NOT NULL,
  "scheduledAt" TIMESTAMPTZ NOT NULL,
  "interviewerId" UUID,
  "feedback" TEXT,
  "result" TEXT
);

CREATE TABLE "KpiCycle" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE "KpiAssignment" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "cycleId" UUID NOT NULL REFERENCES "KpiCycle"("id") ON DELETE CASCADE,
  "employeeId" UUID NOT NULL REFERENCES "Employee"("id"),
  "title" TEXT NOT NULL,
  "target" DECIMAL(12,2) NOT NULL,
  "actual" DECIMAL(12,2),
  "weight" DECIMAL(5,2) NOT NULL,
  "score" DECIMAL(5,2)
);

CREATE TABLE "Course" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "titleEn" TEXT NOT NULL,
  "titleKm" TEXT NOT NULL,
  "description" TEXT,
  "durationH" DECIMAL(6,2) NOT NULL
);

CREATE TABLE "CourseEnrollment" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "courseId" UUID NOT NULL REFERENCES "Course"("id") ON DELETE CASCADE,
  "employeeId" UUID NOT NULL REFERENCES "Employee"("id"),
  "progress" INTEGER NOT NULL DEFAULT 0,
  "completedAt" TIMESTAMPTZ,
  UNIQUE ("courseId", "employeeId")
);

CREATE TABLE "ExpenseClaim" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "employeeId" UUID NOT NULL REFERENCES "Employee"("id"),
  "title" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'KHR',
  "status" "WorkflowStatus" NOT NULL DEFAULT 'SUBMITTED',
  "receiptId" UUID,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "Asset" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "tag" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "serialNo" TEXT,
  "status" TEXT NOT NULL DEFAULT 'available',
  UNIQUE ("tenantId", "tag")
);

CREATE TABLE "AssetAssignment" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "assetId" UUID NOT NULL REFERENCES "Asset"("id") ON DELETE CASCADE,
  "employeeId" UUID NOT NULL REFERENCES "Employee"("id"),
  "assignedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "returnedAt" TIMESTAMPTZ
);

CREATE TABLE "StoredFile" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "bucket" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "checksum" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "Notification" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "userId" UUID REFERENCES "User"("id"),
  "channel" TEXT NOT NULL,
  "titleEn" TEXT NOT NULL,
  "titleKm" TEXT NOT NULL,
  "bodyEn" TEXT NOT NULL,
  "bodyKm" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "sentAt" TIMESTAMPTZ,
  "readAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "OutboxEvent" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "publishedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "OutboxEvent_unpublished_idx" ON "OutboxEvent" ("publishedAt", "createdAt");

CREATE TABLE "AuditLog" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "userId" UUID REFERENCES "User"("id"),
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT,
  "ip" TEXT,
  "userAgent" TEXT,
  "before" JSONB,
  "after" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "AuditLog_tenant_created_idx" ON "AuditLog" ("tenantId", "createdAt");

-- Row Level Security: every tenant-scoped table must filter by tenantId
ALTER TABLE "Employee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PayrollRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_employee ON "Employee"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY tenant_isolation_attendance ON "Attendance"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY tenant_isolation_payroll ON "PayrollRun"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY tenant_isolation_audit ON "AuditLog"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid);
