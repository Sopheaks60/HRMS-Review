/** Returns target achievement as a percentage, capped at 100 and rounded to two decimals. */
export function calculateKpiScore(actual: number, target: number): number {
  if (!Number.isFinite(actual) || actual < 0) {
    throw new RangeError("KPI actual must be a finite non-negative number");
  }
  if (!Number.isFinite(target) || target <= 0) {
    throw new RangeError("KPI target must be a finite positive number");
  }
  return Math.round(Math.min(100, (actual / target) * 100) * 100) / 100;
}
