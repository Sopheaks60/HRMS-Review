/**
 * Cambodia payroll engine.
 *
 * Statutory sources (versioned; override via StatutoryTable.payload):
 * - Tax on Salary: Sub-Decree No. 48 (11 Mar 2024) progressive brackets.
 * - Family relief: KHR 150,000 / qualifying child / month and KHR 150,000
 *   for one household spouse (not both employed spouses).
 * - Non-residents: flat 20% on Cambodia-source salary.
 * - Fringe benefits: flat 20% on market value.
 * - NSSF: occupational risk 0.8% employer; healthcare 2.6% employer;
 *   pension 2% employer + 2% employee (Phase 1, through Sep 2027).
 * - Contributory wage: risk/health floor 200,000 ceiling 1,200,000;
 *   pension floor 400,000 ceiling 1,200,000.
 * - NSSF is not deductible from Tax on Salary.
 *
 * All money is integer riel (KHR) after rounding half-up.
 */

export interface TosBracket {
  from: number;
  to: number | null;
  rate: number;
}

export interface NssfScheme {
  floor: number;
  ceiling: number;
  employerRate: number;
  employeeRate: number;
}

export interface CambodiaStatutoryConfig {
  tosBrackets: TosBracket[];
  nonResidentRate: number;
  fringeBenefitRate: number;
  dependentRelief: number;
  spouseRelief: number;
  nssf: {
    occupationalRisk: NssfScheme;
    healthcare: NssfScheme;
    pension: NssfScheme;
  };
}

export const CAMBODIA_2026: CambodiaStatutoryConfig = {
  tosBrackets: [
    { from: 0, to: 1_500_000, rate: 0 },
    { from: 1_500_001, to: 2_000_000, rate: 0.05 },
    { from: 2_000_001, to: 8_500_000, rate: 0.1 },
    { from: 8_500_001, to: 12_500_000, rate: 0.15 },
    { from: 12_500_001, to: null, rate: 0.2 },
  ],
  nonResidentRate: 0.2,
  fringeBenefitRate: 0.2,
  dependentRelief: 150_000,
  spouseRelief: 150_000,
  nssf: {
    occupationalRisk: {
      floor: 200_000,
      ceiling: 1_200_000,
      employerRate: 0.008,
      employeeRate: 0,
    },
    healthcare: {
      floor: 200_000,
      ceiling: 1_200_000,
      employerRate: 0.026,
      employeeRate: 0,
    },
    pension: {
      floor: 400_000,
      ceiling: 1_200_000,
      employerRate: 0.02,
      employeeRate: 0.02,
    },
  },
};

export function isCambodiaStatutoryConfig(value: unknown): value is CambodiaStatutoryConfig {
  if (!value || typeof value !== "object") return false;
  const config = value as Partial<CambodiaStatutoryConfig>;
  const validScheme = (scheme?: NssfScheme) =>
    !!scheme &&
    Number.isFinite(scheme.floor) &&
    Number.isFinite(scheme.ceiling) &&
    scheme.floor >= 0 &&
    scheme.ceiling >= scheme.floor &&
    scheme.employerRate >= 0 &&
    scheme.employeeRate >= 0;
  return (
    Array.isArray(config.tosBrackets) &&
    config.tosBrackets.length > 0 &&
    config.tosBrackets.every(
      (bracket) =>
        Number.isFinite(bracket.from) &&
        bracket.from >= 0 &&
        (bracket.to === null || Number.isFinite(bracket.to)) &&
        bracket.rate >= 0 &&
        bracket.rate <= 1,
    ) &&
    Number.isFinite(config.nonResidentRate) &&
    Number.isFinite(config.fringeBenefitRate) &&
    Number.isFinite(config.dependentRelief) &&
    Number.isFinite(config.spouseRelief) &&
    !!config.nssf &&
    validScheme(config.nssf.occupationalRisk) &&
    validScheme(config.nssf.healthcare) &&
    validScheme(config.nssf.pension)
  );
}

export interface PayrollInput {
  basic: number;
  allowances: number;
  overtime: number;
  unpaidLeave: number;
  fringeBenefits: number;
  otherDeductions: number;
  taxResidency: "RESIDENT" | "NON_RESIDENT";
  qualifyingChildren: number;
  spouseRelief: boolean;
  statutory?: CambodiaStatutoryConfig;
}

export interface NssfBreakdown {
  contributoryWage: number;
  pensionEe: number;
  pensionEr: number;
  healthEr: number;
  riskEr: number;
  employeeTotal: number;
  employerTotal: number;
}

export interface PayrollResult {
  gross: number;
  familyRelief: number;
  tosBase: number;
  tosAmount: number;
  fringeTax: number;
  nssf: NssfBreakdown;
  net: number;
  employerCost: number;
}

export function roundRiel(value: number): number {
  return Math.round(value);
}

export function clampContributoryWage(
  gross: number,
  floor: number,
  ceiling: number,
): number {
  if (gross <= 0) return 0;
  return Math.min(Math.max(gross, floor), ceiling);
}

export function calculateNssf(
  gross: number,
  cfg: CambodiaStatutoryConfig = CAMBODIA_2026,
): NssfBreakdown {
  const pensionWage = clampContributoryWage(
    gross,
    cfg.nssf.pension.floor,
    cfg.nssf.pension.ceiling,
  );
  const healthWage = clampContributoryWage(
    gross,
    cfg.nssf.healthcare.floor,
    cfg.nssf.healthcare.ceiling,
  );
  const riskWage = clampContributoryWage(
    gross,
    cfg.nssf.occupationalRisk.floor,
    cfg.nssf.occupationalRisk.ceiling,
  );

  const pensionEe = roundRiel(pensionWage * cfg.nssf.pension.employeeRate);
  const pensionEr = roundRiel(pensionWage * cfg.nssf.pension.employerRate);
  const healthEr = roundRiel(healthWage * cfg.nssf.healthcare.employerRate);
  const riskEr = roundRiel(riskWage * cfg.nssf.occupationalRisk.employerRate);

  return {
    contributoryWage: pensionWage,
    pensionEe,
    pensionEr,
    healthEr,
    riskEr,
    employeeTotal: pensionEe,
    employerTotal: pensionEr + healthEr + riskEr,
  };
}

export function calculateProgressiveTos(
  taxable: number,
  brackets: TosBracket[],
): number {
  if (taxable <= 0) return 0;
  let tax = 0;
  for (const b of brackets) {
    const upper = b.to ?? Number.POSITIVE_INFINITY;
    if (taxable < b.from) break;
    const slice = Math.min(taxable, upper) - b.from + (b.from === 0 ? 0 : 1);
    if (slice > 0) tax += slice * b.rate;
  }
  return roundRiel(tax);
}

export function calculatePayroll(input: PayrollInput): PayrollResult {
  const cfg = input.statutory ?? CAMBODIA_2026;
  const gross = roundRiel(
    input.basic + input.allowances + input.overtime - input.unpaidLeave,
  );
  const familyRelief =
    input.taxResidency === "RESIDENT"
      ? input.qualifyingChildren * cfg.dependentRelief +
        (input.spouseRelief ? cfg.spouseRelief : 0)
      : 0;
  const tosBase = Math.max(0, gross - familyRelief);

  const tosAmount =
    input.taxResidency === "NON_RESIDENT"
      ? roundRiel(tosBase * cfg.nonResidentRate)
      : calculateProgressiveTos(tosBase, cfg.tosBrackets);

  const fringeTax = roundRiel(input.fringeBenefits * cfg.fringeBenefitRate);
  const nssf = calculateNssf(Math.max(0, gross), cfg);
  const net = roundRiel(
    gross - tosAmount - nssf.employeeTotal - input.otherDeductions,
  );
  const employerCost = roundRiel(
    gross + input.fringeBenefits + fringeTax + nssf.employerTotal,
  );

  return {
    gross,
    familyRelief,
    tosBase,
    tosAmount,
    fringeTax,
    nssf,
    net,
    employerCost,
  };
}

export function overtimePay(
  monthlyBasic: number,
  workingDays: number,
  hoursPerDay: number,
  hours: number,
  multiplier: number,
): number {
  const hourly = monthlyBasic / workingDays / hoursPerDay;
  return roundRiel(hourly * hours * multiplier);
}

// ---------------------------------------------------------------------------
// Prakas 442 / Art 68 — Seniority Indemnity (Semi-annual, TOS-exempt)
// ---------------------------------------------------------------------------

export type ContractType = "UDC" | "FDC"; // Undetermined vs Fixed Duration

export interface SeniorityInput {
  /** Employment start date */
  hireDate: Date;
  /** Last day of the semester period (e.g. 30 June or 31 December) */
  periodEndDate: Date;
  /** Average monthly wage in KHR for the semester (basic + mandatory allowances) */
  averageMonthlyWageKhr: number;
  contractType: ContractType;
  /** Statutory working days divisor (default 26) */
  workingDays?: number;
}

export interface SeniorityResult {
  /** Days earned in this semi-annual cycle (max 7.5) */
  daysEarned: number;
  /** Daily wage = averageMonthlyWageKhr / workingDays */
  dailyWageKhr: number;
  /** Gross seniority payment = dailyWageKhr × daysEarned */
  seniorityPayKhr: number;
  /** Always 0 — seniority is TOS-exempt under Prakas 442 */
  tosAmount: 0;
  /** FDC employees get 5% Article 73 severance instead (one-time on contract end) */
  isFdcSeverance: boolean;
  /** For FDC: 5% of total wages paid during contract (caller provides totalWagesPaidKhr) */
  fdcSeverancePct: number;
}

/**
 * Calculate Prakas 442 semi-annual seniority indemnity.
 *
 * Rules:
 * - UDC (CDI): 7.5 days per semester, tax-exempt, NSSF-exempt
 * - FDC (CDD): NOT eligible for Prakas 442; use fdcSeverance() for Article 73
 * - Minimum service: employee must have >= 1 month of service in the semester
 * - Partial first semester: pro-rate based on months of service / 6
 */
export function calculateSeniority(input: SeniorityInput): SeniorityResult {
  const workingDays = input.workingDays ?? 26;
  const dailyWageKhr = roundRiel(input.averageMonthlyWageKhr / workingDays);

  if (input.contractType === "FDC") {
    return {
      daysEarned: 0,
      dailyWageKhr,
      seniorityPayKhr: 0,
      tosAmount: 0,
      isFdcSeverance: true,
      fdcSeverancePct: 0.05,
    };
  }

  // Months of service in this semester (cap at 6)
  const hireMs = input.hireDate.getTime();
  const endMs = input.periodEndDate.getTime();
  if (endMs <= hireMs) {
    return { daysEarned: 0, dailyWageKhr, seniorityPayKhr: 0, tosAmount: 0, isFdcSeverance: false, fdcSeverancePct: 0 };
  }

  // Calculate months of service (approximate: 30-day month)
  const monthsOfService = Math.min(6, (endMs - hireMs) / (30 * 24 * 60 * 60 * 1000));
  if (monthsOfService < 1) {
    return { daysEarned: 0, dailyWageKhr, seniorityPayKhr: 0, tosAmount: 0, isFdcSeverance: false, fdcSeverancePct: 0 };
  }

  // Pro-rate for partial first semester, full 7.5 days thereafter
  const daysEarned = monthsOfService >= 6 ? 7.5 : Math.round((monthsOfService / 6) * 7.5 * 10) / 10;
  const seniorityPayKhr = roundRiel(dailyWageKhr * daysEarned);

  return {
    daysEarned,
    dailyWageKhr,
    seniorityPayKhr,
    tosAmount: 0,
    isFdcSeverance: false,
    fdcSeverancePct: 0,
  };
}

/**
 * Article 73 FDC severance: 5% of total wages paid during the contract.
 */
export function fdcSeverance(totalWagesPaidKhr: number): number {
  return roundRiel(totalWagesPaidKhr * 0.05);
}

