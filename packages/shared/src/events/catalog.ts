export const EVENTS = {
  TENANT_PROVISIONED: "tenant.provisioned",
  USER_INVITED: "user.invited",
  ATTENDANCE_PUNCHED: "attendance.punched",
  LEAVE_SUBMITTED: "leave.submitted",
  LEAVE_DECIDED: "leave.decided",
  OVERTIME_DECIDED: "overtime.decided",
  PAYROLL_CALCULATED: "payroll.calculated",
  PAYROLL_APPROVED: "payroll.approved",
  PAYROLL_PAID: "payroll.paid",
  PAYSLIP_GENERATED: "payslip.generated",
  APPLICATION_MOVED: "recruitment.stage_changed",
  APPLICATION_CREATED: "recruitment.application_created",
  EXPENSE_SUBMITTED: "expense.submitted",
  BIOMETRIC_INGESTED: "biometric.ingested",
} as const;

export type DomainEventType = (typeof EVENTS)[keyof typeof EVENTS];
