/**
 * Centralized Cambodia HRMS Calculation Workflow Engine.
 *
 * Implements a unified calculation pipeline according to:
 * - Cambodia Labor Law 1997 & Article 139 (Overtime Multipliers)
 * - Prakas 442 (Seniority Indemnity) & Article 73 (FDC Severance)
 * - NSSF Sub-Decree 144 (Social Security caps & contributions)
 * - GDT Sub-Decree 48 (March 2024 Progressive Tax on Salary)
 * - Ministry of Labour Article 166 (Seniority Annual Leave Accrual)
 */

import {
  CAMBODIA_2026,
  CambodiaStatutoryConfig,
  ContractType,
  calculateNssf,
  calculateProgressiveTos,
  calculateSeniority,
  fdcSeverance,
  roundRiel,
} from './cambodia.js';

export interface OvertimeInput {
  normalHours: number;    // 1.5x (normal working day beyond 8h)
  nightHours: number;     // 2.0x (22:00 - 06:00 Article 139)
  restDayHours: number;   // 2.0x (weekly rest day / Sunday)
  holidayHours: number;   // 2.0x (official public holidays)
}

export interface OvertimeBreakdown {
  hourlyRateUsd: number;
  hourlyRateKhr: number;
  normalPayUsd: number;
  normalPayKhr: number;
  nightPayUsd: number;
  nightPayKhr: number;
  restDayPayUsd: number;
  restDayPayKhr: number;
  holidayPayUsd: number;
  holidayPayKhr: number;
  totalOtHours: number;
  totalOtPayUsd: number;
  totalOtPayKhr: number;
  isMonthlyCapExceeded: boolean; // Over 54 hrs/month statutory cap
}

export interface CentralizedCalculationInput {
  // Base Salary & Currency
  baseSalaryUsd: number;
  fxUsdKhr?: number; // default 4100
  currencyPreference?: 'USD' | 'KHR';
  hybridSplitUsdPct?: number; // e.g. 70 for 70% USD / 30% KHR

  // Working schedule
  workingDays?: number; // default 26
  hoursPerDay?: number; // default 8

  // Overtime
  overtime?: OvertimeInput;

  // Allowances & Deductions
  taxableAllowancesUsd?: number;
  nonTaxableAllowancesUsd?: number; // statutory transport, uniform
  fringeBenefitsUsd?: number;
  unpaidLeaveDays?: number;
  advanceLoanDeductionsUsd?: number;
  otherDeductionsUsd?: number;

  // Family & Tax Residency
  taxResidency?: 'RESIDENT' | 'NON_RESIDENT';
  qualifyingChildren?: number;
  qualifyingSpouse?: boolean;

  // Seniority & Contract
  contractType?: ContractType; // 'UDC' | 'FDC'
  hireDate?: Date;
  periodEndDate?: Date;

  // Baseline for MoM Variance Check
  previousMonthGrossUsd?: number;

  // Optional custom statutory table
  statutoryConfig?: CambodiaStatutoryConfig;
}

export interface AuditStep {
  step: number;
  name: string;
  basis: string;
  formula: string;
  inputs: Record<string, any>;
  resultKhr: number;
  resultUsd: number;
}

export interface CentralizedCalculationResult {
  // Overtime
  overtime: OvertimeBreakdown;

  // Seniority
  seniorityDaysEarned: number;
  seniorityPayUsd: number;
  seniorityPayKhr: number;
  isFdcSeverance: boolean;
  fdcSeveranceUsd: number;
  fdcSeveranceKhr: number;

  // Gross Earnings
  baseSalaryKhr: number;
  unpaidLeaveDeductionUsd: number;
  unpaidLeaveDeductionKhr: number;
  grossSalaryUsd: number;
  grossSalaryKhr: number;

  // NSSF Sub-Decree 144
  nssfInsurableWageKhr: number;
  nssfOccupationalRiskErKhr: number;
  nssfHealthCareEeKhr: number;
  nssfHealthCareErKhr: number;
  nssfPensionEeKhr: number;
  nssfPensionErKhr: number;
  nssfEmployeeTotalKhr: number;
  nssfEmployeeTotalUsd: number;
  nssfEmployerTotalKhr: number;
  nssfEmployerTotalUsd: number;

  // GDT Progressive Tax on Salary
  familyReliefKhr: number;
  familyReliefUsd: number;
  taxableSalaryKhr: number;
  taxableSalaryUsd: number;
  tosAmountKhr: number;
  tosAmountUsd: number;
  effectiveTaxRatePct: number;
  fringeBenefitTaxUsd: number;
  fringeBenefitTaxKhr: number;

  // Subsistence Protection Gate
  advanceLoanDeductionUsd: number;
  isLoanDeductionCapped: boolean; // Capped at 20% Net subsistence cap

  // Net Payout & Dual-Currency
  totalDeductionsUsd: number;
  totalDeductionsKhr: number;
  netSalaryUsd: number;
  netSalaryKhr: number;
  payoutSplitUsd: number;
  payoutSplitKhr: number;

  // Employer Total Cost of Employment (TCOE)
  totalEmployerCostUsd: number;
  totalEmployerCostKhr: number;

  // Month-over-Month Variance Gate
  momVariancePct: number;
  isVarianceAlertTriggered: boolean; // > 10%
  varianceCostDrivers: string[];

  // Step-by-Step Mathematical Audit Trace
  auditTrace: AuditStep[];
}

/**
 * Execute the Centralized Calculation Workflow
 */
export function runCentralizedCalculationWorkflow(
  input: CentralizedCalculationInput,
): CentralizedCalculationResult {
  const fx = input.fxUsdKhr ?? 4100;
  const workingDays = input.workingDays ?? 26;
  const hoursPerDay = input.hoursPerDay ?? 8;
  const totalStandardHours = workingDays * hoursPerDay; // 208 hours
  const cfg = input.statutoryConfig ?? CAMBODIA_2026;
  const trace: AuditStep[] = [];

  // 1. Hourly Rate & Overtime (Article 139)
  const hourlyRateUsd = input.baseSalaryUsd / totalStandardHours;
  const hourlyRateKhr = roundRiel(hourlyRateUsd * fx);

  const ot = input.overtime ?? { normalHours: 0, nightHours: 0, restDayHours: 0, holidayHours: 0 };
  const normalPayUsd = ot.normalHours * hourlyRateUsd * 1.5;
  const nightPayUsd = ot.nightHours * hourlyRateUsd * 2.0;
  const restDayPayUsd = ot.restDayHours * hourlyRateUsd * 2.0;
  const holidayPayUsd = ot.holidayHours * hourlyRateUsd * 2.0;
  const totalOtHours = ot.normalHours + ot.nightHours + ot.restDayHours + ot.holidayHours;
  const totalOtPayUsd = normalPayUsd + nightPayUsd + restDayPayUsd + holidayPayUsd;
  const totalOtPayKhr = roundRiel(totalOtPayUsd * fx);

  const overtimeBreakdown: OvertimeBreakdown = {
    hourlyRateUsd,
    hourlyRateKhr,
    normalPayUsd,
    normalPayKhr: roundRiel(normalPayUsd * fx),
    nightPayUsd,
    nightPayKhr: roundRiel(nightPayUsd * fx),
    restDayPayUsd,
    restDayPayKhr: roundRiel(restDayPayUsd * fx),
    holidayPayUsd,
    holidayPayKhr: roundRiel(holidayPayUsd * fx),
    totalOtHours,
    totalOtPayUsd,
    totalOtPayKhr,
    isMonthlyCapExceeded: totalOtHours > 54,
  };

  trace.push({
    step: 1,
    name: 'Article 139 Overtime Calculation',
    basis: 'Cambodia Labor Law Art 139 (1.5x Normal, 2.0x Night/Rest/Holiday)',
    formula: `Hourly = Base / ${totalStandardHours}h; OT = Σ(Hours × Multiplier × Hourly)`,
    inputs: { baseSalaryUsd: input.baseSalaryUsd, ...ot },
    resultUsd: totalOtPayUsd,
    resultKhr: totalOtPayKhr,
  });

  // 2. Unpaid Leave Deduction
  const dailyRateUsd = input.baseSalaryUsd / workingDays;
  const unpaidLeaveDays = input.unpaidLeaveDays ?? 0;
  const unpaidLeaveDeductionUsd = unpaidLeaveDays * dailyRateUsd;
  const unpaidLeaveDeductionKhr = roundRiel(unpaidLeaveDeductionUsd * fx);

  // 3. Seniority Indemnity (Prakas 442) or FDC Severance (Article 73)
  let seniorityDaysEarned = 0;
  let seniorityPayKhr = 0;
  let isFdc = input.contractType === 'FDC';
  let fdcSevKhr = 0;

  if (input.hireDate && input.periodEndDate) {
    const seniorityRes = calculateSeniority({
      hireDate: input.hireDate,
      periodEndDate: input.periodEndDate,
      averageMonthlyWageKhr: roundRiel(input.baseSalaryUsd * fx),
      contractType: input.contractType ?? 'UDC',
      workingDays,
    });
    seniorityDaysEarned = seniorityRes.daysEarned;
    seniorityPayKhr = seniorityRes.seniorityPayKhr;
    if (seniorityRes.isFdcSeverance) {
      fdcSevKhr = fdcSeverance(roundRiel(input.baseSalaryUsd * fx * 6));
    }
  }

  const seniorityPayUsd = seniorityPayKhr / fx;
  const fdcSeveranceUsd = fdcSevKhr / fx;

  trace.push({
    step: 2,
    name: 'Seniority Indemnity (Prakas 442) / Severance (Art 73)',
    basis: isFdc ? 'Article 73 (5% Contract Total)' : 'Prakas 442 (7.5 days/semester, 100% TOS-exempt)',
    formula: isFdc ? 'Total Wages × 5%' : '(Average Monthly / 26) × 7.5 days',
    inputs: { contractType: input.contractType, daysEarned: seniorityDaysEarned },
    resultUsd: isFdc ? fdcSeveranceUsd : seniorityPayUsd,
    resultKhr: isFdc ? fdcSevKhr : seniorityPayKhr,
  });

  // 4. Gross Salary
  const taxableAllowancesUsd = input.taxableAllowancesUsd ?? 0;
  const nonTaxableAllowancesUsd = input.nonTaxableAllowancesUsd ?? 0;
  const grossSalaryUsd =
    input.baseSalaryUsd +
    totalOtPayUsd +
    taxableAllowancesUsd +
    nonTaxableAllowancesUsd +
    seniorityPayUsd -
    unpaidLeaveDeductionUsd;
  const grossSalaryKhr = roundRiel(grossSalaryUsd * fx);

  trace.push({
    step: 3,
    name: 'Total Gross Earnings Consolidation',
    basis: 'Base + Overtime + Allowances + Seniority - Unpaid Leave',
    formula: 'Base + OT + Allowances + Seniority - UnpaidLeave',
    inputs: { base: input.baseSalaryUsd, ot: totalOtPayUsd, allowances: taxableAllowancesUsd + nonTaxableAllowancesUsd },
    resultUsd: grossSalaryUsd,
    resultKhr: grossSalaryKhr,
  });

  // 5. NSSF Sub-Decree 144
  // Insurable wage excludes Seniority (exempt) and non-taxable allowances
  const nssfWageBaseKhr = roundRiel(
    (input.baseSalaryUsd + totalOtPayUsd + taxableAllowancesUsd - unpaidLeaveDeductionUsd) * fx,
  );
  const nssf = calculateNssf(nssfWageBaseKhr, cfg);
  const nssfEmployeeTotalUsd = nssf.employeeTotal / fx;
  const nssfEmployerTotalUsd = nssf.employerTotal / fx;

  trace.push({
    step: 4,
    name: 'NSSF Social Security Contribution (Sub-Decree 144)',
    basis: 'Pension 4% (2% EE / 2% ER) + Health 5.2% (2.6% EE / 2.6% ER) + Risk 0.8% ER (Floor: 400k, Ceiling: 1.2M KHR)',
    formula: 'Clamp(WageBase, 400k, 1.2M) × Scheme Rates',
    inputs: { insurableWageKhr: nssfWageBaseKhr, cappedWage: Math.min(1200000, Math.max(400000, nssfWageBaseKhr)) },
    resultUsd: nssfEmployeeTotalUsd,
    resultKhr: nssf.employeeTotal,
  });

  // 6. GDT Progressive Tax on Salary (Sub-Decree 48)
  const qualifyingChildren = input.qualifyingChildren ?? 0;
  const spouseRelief = input.qualifyingSpouse ?? false;
  const familyReliefKhr =
    input.taxResidency === 'NON_RESIDENT'
      ? 0
      : qualifyingChildren * cfg.dependentRelief + (spouseRelief ? cfg.spouseRelief : 0);
  const familyReliefUsd = familyReliefKhr / fx;

  // Seniority Indemnity is strictly exempt from TOS
  const tosGrossKhr = roundRiel(
    (input.baseSalaryUsd + totalOtPayUsd + taxableAllowancesUsd - unpaidLeaveDeductionUsd) * fx,
  );
  const taxableSalaryKhr = Math.max(0, tosGrossKhr - familyReliefKhr);
  const taxableSalaryUsd = taxableSalaryKhr / fx;

  let tosAmountKhr = 0;
  if (input.taxResidency === 'NON_RESIDENT') {
    tosAmountKhr = roundRiel(tosGrossKhr * cfg.nonResidentRate);
  } else {
    tosAmountKhr = calculateProgressiveTos(taxableSalaryKhr, cfg.tosBrackets);
  }
  const tosAmountUsd = tosAmountKhr / fx;
  const effectiveTaxRatePct = tosGrossKhr > 0 ? (tosAmountKhr / tosGrossKhr) * 100 : 0;

  // Fringe Benefits Tax (20%)
  const fringeBenefitsUsd = input.fringeBenefitsUsd ?? 0;
  const fringeBenefitTaxUsd = fringeBenefitsUsd * cfg.fringeBenefitRate;
  const fringeBenefitTaxKhr = roundRiel(fringeBenefitTaxUsd * fx);

  trace.push({
    step: 5,
    name: 'GDT Progressive Tax on Salary (Sub-Decree 48)',
    basis: 'Progressive Brackets (0% - 20%) after 150k KHR Family Relief',
    formula: 'ProgressiveTos(TaxableBase - FamilyRelief)',
    inputs: { taxableSalaryKhr, familyReliefKhr, taxResidency: input.taxResidency ?? 'RESIDENT' },
    resultUsd: tosAmountUsd,
    resultKhr: tosAmountKhr,
  });

  // 7. Subsistence Protection Gate: Max 20% Net Deduction for Salary Advance / Loan
  const prelimNetUsd = grossSalaryUsd - tosAmountUsd - nssfEmployeeTotalUsd - (input.otherDeductionsUsd ?? 0);
  const maxAllowableLoanDeductionUsd = prelimNetUsd * 0.20; // 20% Net cap
  const requestedLoanDeductionUsd = input.advanceLoanDeductionsUsd ?? 0;
  const advanceLoanDeductionUsd = Math.min(requestedLoanDeductionUsd, maxAllowableLoanDeductionUsd);
  const isLoanDeductionCapped = requestedLoanDeductionUsd > maxAllowableLoanDeductionUsd;

  // 8. Net Salary & Dual-Currency Split
  const totalDeductionsUsd = tosAmountUsd + nssfEmployeeTotalUsd + advanceLoanDeductionUsd + (input.otherDeductionsUsd ?? 0);
  const totalDeductionsKhr = roundRiel(totalDeductionsUsd * fx);
  const netSalaryUsd = Math.max(0, grossSalaryUsd - totalDeductionsUsd);
  const netSalaryKhr = roundRiel(netSalaryUsd * fx);

  const hybridSplitPct = input.hybridSplitUsdPct ?? (input.currencyPreference === 'KHR' ? 0 : 100);
  const payoutSplitUsd = (netSalaryUsd * hybridSplitPct) / 100;
  const payoutSplitKhr = roundRiel((netSalaryKhr * (100 - hybridSplitPct)) / 100);

  // 9. Total Employer Cost of Employment (TCOE)
  const totalEmployerCostUsd = grossSalaryUsd + nssfEmployerTotalUsd + fringeBenefitsUsd + fringeBenefitTaxUsd;
  const totalEmployerCostKhr = roundRiel(totalEmployerCostUsd * fx);

  trace.push({
    step: 6,
    name: 'Net Pay Payout & Dual-Currency Disbursement',
    basis: 'Gross - Deductions (TOS + NSSF + Advance)',
    formula: 'Gross - (TOS + NSSF_EE + AdvanceLoan + OtherDeductions)',
    inputs: { grossSalaryUsd, totalDeductionsUsd, splitPct: `${hybridSplitPct}% USD / ${100 - hybridSplitPct}% KHR` },
    resultUsd: netSalaryUsd,
    resultKhr: netSalaryKhr,
  });

  // 10. Month-over-Month 10% Variance Gate
  let momVariancePct = 0;
  let isVarianceAlertTriggered = false;
  const varianceCostDrivers: string[] = [];

  if (input.previousMonthGrossUsd && input.previousMonthGrossUsd > 0) {
    momVariancePct = Math.round(((grossSalaryUsd - input.previousMonthGrossUsd) / input.previousMonthGrossUsd) * 1000) / 10;
    if (Math.abs(momVariancePct) >= 10.0) {
      isVarianceAlertTriggered = true;
      if (totalOtPayUsd > 0) varianceCostDrivers.push(`Article 139 Overtime surge ($${totalOtPayUsd.toFixed(2)})`);
      if (seniorityPayUsd > 0) varianceCostDrivers.push(`Prakas 442 Semi-annual Seniority payout ($${seniorityPayUsd.toFixed(2)})`);
      if (taxableAllowancesUsd > 0) varianceCostDrivers.push(`Discretionary allowances ($${taxableAllowancesUsd.toFixed(2)})`);
    }
  }

  return {
    overtime: overtimeBreakdown,
    seniorityDaysEarned,
    seniorityPayUsd,
    seniorityPayKhr,
    isFdcSeverance: isFdc,
    fdcSeveranceUsd,
    fdcSeveranceKhr: fdcSevKhr,
    baseSalaryKhr: roundRiel(input.baseSalaryUsd * fx),
    unpaidLeaveDeductionUsd,
    unpaidLeaveDeductionKhr,
    grossSalaryUsd,
    grossSalaryKhr,
    nssfInsurableWageKhr: nssfWageBaseKhr,
    nssfOccupationalRiskErKhr: nssf.riskEr,
    nssfHealthCareEeKhr: 0,
    nssfHealthCareErKhr: nssf.healthEr,
    nssfPensionEeKhr: nssf.pensionEe,
    nssfPensionErKhr: nssf.pensionEr,
    nssfEmployeeTotalKhr: nssf.employeeTotal,
    nssfEmployeeTotalUsd,
    nssfEmployerTotalKhr: nssf.employerTotal,
    nssfEmployerTotalUsd,
    familyReliefKhr,
    familyReliefUsd,
    taxableSalaryKhr,
    taxableSalaryUsd,
    tosAmountKhr,
    tosAmountUsd,
    effectiveTaxRatePct: Math.round(effectiveTaxRatePct * 10) / 10,
    fringeBenefitTaxUsd,
    fringeBenefitTaxKhr,
    advanceLoanDeductionUsd,
    isLoanDeductionCapped,
    totalDeductionsUsd,
    totalDeductionsKhr,
    netSalaryUsd,
    netSalaryKhr,
    payoutSplitUsd,
    payoutSplitKhr,
    totalEmployerCostUsd,
    totalEmployerCostKhr,
    momVariancePct,
    isVarianceAlertTriggered,
    varianceCostDrivers,
    auditTrace: trace,
  };
}

/**
 * Algebraic & Iterative Reverse Net-to-Gross Solver
 * Calculates the exact Gross salary required to deliver a guaranteed target Net salary.
 */
export function calculateNetToGross(
  targetNetUsd: number,
  options: Omit<CentralizedCalculationInput, 'baseSalaryUsd'> = {},
): { requiredGrossUsd: number; requiredGrossKhr: number; iterations: number; convergedResult: CentralizedCalculationResult } {
  let low = targetNetUsd;
  let high = targetNetUsd * 1.5; // Initial upper bound
  let iteration = 0;
  const maxIterations = 50;
  const tolerance = 0.01; // within 1 cent

  let currentGross = targetNetUsd;
  let result = runCentralizedCalculationWorkflow({ ...options, baseSalaryUsd: currentGross });

  // Expand high bound if necessary
  while (result.netSalaryUsd < targetNetUsd && iteration < 10) {
    high *= 1.25;
    result = runCentralizedCalculationWorkflow({ ...options, baseSalaryUsd: high });
    iteration++;
  }

  // Binary search convergence
  while (iteration < maxIterations) {
    iteration++;
    currentGross = (low + high) / 2;
    result = runCentralizedCalculationWorkflow({ ...options, baseSalaryUsd: currentGross });
    const diff = result.netSalaryUsd - targetNetUsd;

    if (Math.abs(diff) <= tolerance) {
      break;
    }

    if (diff < 0) {
      low = currentGross;
    } else {
      high = currentGross;
    }
  }

  const fx = options.fxUsdKhr ?? 4100;
  return {
    requiredGrossUsd: Math.round(currentGross * 100) / 100,
    requiredGrossKhr: roundRiel(currentGross * fx),
    iterations: iteration,
    convergedResult: result,
  };
}
