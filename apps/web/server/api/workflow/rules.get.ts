import { defineEventHandler } from 'h3';

export interface WorkflowRule {
  id: string;
  code: string;
  name: string;
  category: 'ATTENDANCE' | 'PAYROLL' | 'DEBT_RECOVERY' | 'LEAVE' | 'SENIORITY';
  triggerCondition: string;
  statutoryBasis: string;
  parameterThreshold: number;
  thresholdUnit: string;
  approvalLevels: string[];
  autoApproveIfBelow: boolean;
  activeStatus: boolean;
  description: string;
}

export const WORKFLOW_RULES: WorkflowRule[] = [
  {
    id: 'WF-01',
    code: 'WF-ATT-OT-ESCALATION',
    name: 'Article 139 Daily Overtime Surge Approval Gate',
    category: 'ATTENDANCE',
    triggerCondition: 'Daily overtime hours exceed threshold in a single shift',
    statutoryBasis: 'Cambodia Labor Law Article 139',
    parameterThreshold: 2.0,
    thresholdUnit: 'Hours OT / Shift',
    approvalLevels: ['Line Manager (Tier 1)', 'Operations Director (Tier 2)'],
    autoApproveIfBelow: true,
    activeStatus: true,
    description: 'If daily overtime is under 2.0 hours, it auto-approves. If ≥2.0h or Night OT (200%), escalates to Operations Director under Cambodia Labor Law Art 139.',
  },
  {
    id: 'WF-02',
    code: 'WF-ATT-OT-MONTHLY-CAP',
    name: 'MoLVT Article 139 Statutory Monthly OT Ceiling (54 Hours)',
    category: 'ATTENDANCE',
    triggerCondition: 'Cumulative monthly overtime hours exceed statutory ceiling',
    statutoryBasis: 'MoLVT Prakas on Maximum Overtime Hours',
    parameterThreshold: 54.0,
    thresholdUnit: 'Hours / Month',
    approvalLevels: ['HR Compliance Director', 'MoLVT Special Approval Permit'],
    autoApproveIfBelow: true,
    activeStatus: true,
    description: 'Strict statutory cap: Cumulative overtime exceeding 54 hours in a calendar month requires special MoLVT authorization.',
  },
  {
    id: 'WF-03',
    code: 'WF-PAY-MOM-VARIANCE',
    name: 'Month-over-Month 10% Gross Payroll Variance Gate',
    category: 'PAYROLL',
    triggerCondition: 'Payroll cycle gross expenditure variance vs previous month baseline exceeds threshold',
    statutoryBasis: 'KromPay Enterprise Governance & Internal Controls (SoD)',
    parameterThreshold: 10.0,
    thresholdUnit: '% Variance',
    approvalLevels: ['Payroll Preparer', 'Chief Financial Officer', 'CEO Digital Counter-Sign'],
    autoApproveIfBelow: false,
    activeStatus: true,
    description: 'Any gross pay increase exceeding 10% triggers an explainability audit gate and requires dual CFO + CEO digital signatures before bank file locking.',
  },
  {
    id: 'WF-04',
    code: 'WF-DEBT-SUBSISTENCE-CAP',
    name: 'Cambodia Labor Law 20% Net Subsistence Debt Recovery Cap',
    category: 'DEBT_RECOVERY',
    triggerCondition: 'Salary advance / loan repayment deduction exceeds percentage of net salary',
    statutoryBasis: 'Cambodia Labor Law Subsistence Protection',
    parameterThreshold: 20.0,
    thresholdUnit: '% Net Pay Cap',
    approvalLevels: ['Payroll Specialist', 'Finance Director'],
    autoApproveIfBelow: true,
    activeStatus: true,
    description: 'Cambodia Labor Law subsistence protection: Total monthly loan/advance deductions are strictly capped at 20% of net pay. Unpaid balances auto-spread over 3-6 months.',
  },
  {
    id: 'WF-05',
    code: 'WF-SEN-PRAKAS442',
    name: 'Prakas 442 Seniority Indemnity Biannual Payout Gate',
    category: 'SENIORITY',
    triggerCondition: 'Semi-annual entitlement cycle trigger (June 30 / December 31)',
    statutoryBasis: 'MoLVT Prakas No. 442 & Labor Law Article 89',
    parameterThreshold: 7.5,
    thresholdUnit: 'Days of Wages',
    approvalLevels: ['HR Generalist', 'General Counsel', 'VP of Finance'],
    autoApproveIfBelow: false,
    activeStatus: true,
    description: 'Mandatory 7.5 days of wages per semester for all UDC employees. Strictly exempt from Tax on Salary and NSSF deductions.',
  },
];

export default defineEventHandler(async () => {
  return {
    success: true,
    rules: WORKFLOW_RULES,
  };
});

