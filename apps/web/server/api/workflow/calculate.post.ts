import { defineEventHandler, readBody } from 'h3';
import { runCentralizedCalculationWorkflow, CentralizedCalculationInput } from '@krompay/shared';

export default defineEventHandler(async (event) => {
  const body: CentralizedCalculationInput = await readBody(event);
  
  // Execute the centralized calculation workflow
  const result = runCentralizedCalculationWorkflow({
    baseSalaryUsd: Number(body.baseSalaryUsd || 1000),
    fxUsdKhr: Number(body.fxUsdKhr || 4100),
    currencyPreference: body.currencyPreference || 'USD',
    hybridSplitUsdPct: body.hybridSplitUsdPct ?? 100,
    workingDays: Number(body.workingDays || 26),
    hoursPerDay: Number(body.hoursPerDay || 8),
    overtime: body.overtime || { normalHours: 0, nightHours: 0, restDayHours: 0, holidayHours: 0 },
    taxableAllowancesUsd: Number(body.taxableAllowancesUsd || 0),
    nonTaxableAllowancesUsd: Number(body.nonTaxableAllowancesUsd || 0),
    fringeBenefitsUsd: Number(body.fringeBenefitsUsd || 0),
    unpaidLeaveDays: Number(body.unpaidLeaveDays || 0),
    advanceLoanDeductionsUsd: Number(body.advanceLoanDeductionsUsd || 0),
    otherDeductionsUsd: Number(body.otherDeductionsUsd || 0),
    taxResidency: body.taxResidency || 'RESIDENT',
    qualifyingChildren: Number(body.qualifyingChildren || 0),
    qualifyingSpouse: Boolean(body.qualifyingSpouse),
    contractType: body.contractType || 'UDC',
    hireDate: body.hireDate ? new Date(body.hireDate) : undefined,
    periodEndDate: body.periodEndDate ? new Date(body.periodEndDate) : undefined,
    previousMonthGrossUsd: body.previousMonthGrossUsd ? Number(body.previousMonthGrossUsd) : undefined,
  });

  return {
    success: true,
    engine: 'KromPay Autonomous Gross-to-Net Workflow Solver (v2026.2)',
    statutoryBasis: 'Cambodia Labor Law (1997), Sub-Decree 48 TOS, Sub-Decree 144 NSSF, Prakas 442',
    calculatedAt: new Date().toISOString(),
    data: result,
  };
});

