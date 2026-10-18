import { describe, expect, it } from "vitest";
import { calculateKpiScore } from "./kpi.js";

describe("KPI scoring", () => {
  it("returns the achieved percentage", () => {
    expect(calculateKpiScore(37.5, 50)).toBe(75);
  });

  it("caps achievement at 100 percent", () => {
    expect(calculateKpiScore(120, 100)).toBe(100);
  });

  it("rounds the score to two decimal places", () => {
    expect(calculateKpiScore(1, 3)).toBe(33.33);
  });

  it("rejects invalid actuals and targets", () => {
    expect(() => calculateKpiScore(-1, 10)).toThrow(RangeError);
    expect(() => calculateKpiScore(Number.NaN, 10)).toThrow(RangeError);
    expect(() => calculateKpiScore(1, 0)).toThrow(RangeError);
  });
});
