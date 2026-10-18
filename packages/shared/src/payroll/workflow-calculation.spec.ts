import { describe, expect, it } from 'vitest';
import {
  calculateNetToGross,
  runCentralizedCalculationWorkflow,
} from './workflow-calculation.js';

describe('Centralized Calculation Workflow Engine', () => {
  it('calculates Article 139 Overtime multipliers accurately', () => {
    const res = runCentralizedCalculationWorkflow({
      baseSalaryUsd: 1040, // 1040 / 208 = $5/hr
      overtime: {
        normalHours: 10,   // 10 × $5 × 1.5 = $75
        nightHours: 5,     // 5 × $5 × 2.0 = $50
        restDayHours: 4,   // 4 × $5 × 2.0 = $40
        holidayHours: 2,   // 2 × $5 × 2.0 = $20
      },
      fxUsdKhr: 4100,
    });

    expect(res.overtime.hourlyRateUsd).toBe(5);
    expect(res.overtime.normalPayUsd).toBe(75);
    expect(res.overtime.nightPayUsd).toBe(50);
    expect(res.overtime.restDayPayUsd).toBe(40);
    expect(res.overtime.holidayPayUsd).toBe(20);
    expect(res.overtime.totalOtPayUsd).toBe(185);
    expect(res.overtime.totalOtHours).toBe(21);
    expect(res.overtime.isMonthlyCapExceeded).toBe(false);
  });

  it('enforces 20% Net subsistence cap for loan deductions', () => {
    const res = runCentralizedCalculationWorkflow({
      baseSalaryUsd: 1000,
      advanceLoanDeductionsUsd: 500, // Requesting $500 deduction
      fxUsdKhr: 4100,
    });

    // Net pay is around $900-$950, so 20% cap should restrict loan deduction to ~$180-$190
    expect(res.isLoanDeductionCapped).toBe(true);
    expect(res.advanceLoanDeductionUsd).toBeLessThan(250);
    expect(res.advanceLoanDeductionUsd).toBeGreaterThan(150);
  });

  it('triggers Month-over-Month variance alert when gross exceeds 10%', () => {
    const res = runCentralizedCalculationWorkflow({
      baseSalaryUsd: 1500,
      previousMonthGrossUsd: 1200, // 25% increase
      taxableAllowancesUsd: 100,
      fxUsdKhr: 4100,
    });

    expect(res.isVarianceAlertTriggered).toBe(true);
    expect(res.momVariancePct).toBeGreaterThan(10);
  });

  it('reverse calculates Gross from target Net accurately (Reverse Net-to-Gross Solver)', () => {
    const targetNetUsd = 1200;
    const { requiredGrossUsd, convergedResult } = calculateNetToGross(targetNetUsd, {
      fxUsdKhr: 4100,
      qualifyingChildren: 1,
    });

    expect(requiredGrossUsd).toBeGreaterThan(targetNetUsd);
    // Converged net should be within $0.05 of target net
    expect(Math.abs(convergedResult.netSalaryUsd - targetNetUsd)).toBeLessThanOrEqual(0.05);
  });
});
