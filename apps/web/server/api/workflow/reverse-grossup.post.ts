import { defineEventHandler, readBody } from 'h3';
import { calculateNetToGross } from '@krompay/shared';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const targetNetUsd = Number(body.targetNetUsd || 1500);

  const solution = calculateNetToGross(targetNetUsd, {
    fxUsdKhr: Number(body.fxUsdKhr || 4100),
    currencyPreference: body.currencyPreference || 'USD',
    taxResidency: body.taxResidency || 'RESIDENT',
    qualifyingChildren: Number(body.qualifyingChildren || 0),
    qualifyingSpouse: Boolean(body.qualifyingSpouse),
    workingDays: Number(body.workingDays || 26),
    hoursPerDay: Number(body.hoursPerDay || 8),
    contractType: body.contractType || 'UDC',
  });

  return {
    success: true,
    engine: 'KromPay Net-to-Gross Reverse Algebraic Solver',
    targetNetUsd,
    targetNetKhr: Math.round(targetNetUsd * Number(body.fxUsdKhr || 4100)),
    requiredGrossUsd: solution.requiredGrossUsd,
    requiredGrossKhr: solution.requiredGrossKhr,
    iterationsToConvergence: solution.iterations,
    convergedPayrollBreakdown: solution.convergedResult,
  };
});
