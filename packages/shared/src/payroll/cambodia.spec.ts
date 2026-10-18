import { describe, expect, it } from "vitest";
import {
  CAMBODIA_2026,
  calculateNssf,
  calculatePayroll,
  calculateProgressiveTos,
  calculateSeniority,
  fdcSeverance,
  isCambodiaStatutoryConfig,
  overtimePay,
} from "./cambodia.js";

describe("Cambodia Tax on Salary", () => {
  it("accepts the versioned Cambodia statutory table", () => {
    expect(isCambodiaStatutoryConfig(CAMBODIA_2026)).toBe(true);
  });

  it("rejects malformed statutory tables", () => {
    expect(isCambodiaStatutoryConfig({ tosBrackets: [], nssf: {} })).toBe(false);
  });

  it("is zero at the 1,500,000 exempt threshold", () => {
    expect(calculateProgressiveTos(1_500_000, CAMBODIA_2026.tosBrackets)).toBe(0);
  });

  it("applies 5% on the 1.5m–2m band", () => {
    // 2,000,000: 500,000 * 5% = 25,000
    expect(calculateProgressiveTos(2_000_000, CAMBODIA_2026.tosBrackets)).toBe(25_000);
  });

  it("applies 10% into the third band", () => {
    // 3,000,000: 25,000 + 1,000,000 * 10% = 125,000
    expect(calculateProgressiveTos(3_000_000, CAMBODIA_2026.tosBrackets)).toBe(125_000);
  });

  it("taxes non-residents at a flat 20%", () => {
    const r = calculatePayroll({
      basic: 4_000_000,
      allowances: 0,
      overtime: 0,
      unpaidLeave: 0,
      fringeBenefits: 0,
      otherDeductions: 0,
      taxResidency: "NON_RESIDENT",
      qualifyingChildren: 2,
      spouseRelief: true,
    });
    expect(r.familyRelief).toBe(0);
    expect(r.tosAmount).toBe(800_000);
  });

  it("reduces resident TOS base by child and spouse relief", () => {
    const r = calculatePayroll({
      basic: 2_000_000,
      allowances: 0,
      overtime: 0,
      unpaidLeave: 0,
      fringeBenefits: 0,
      otherDeductions: 0,
      taxResidency: "RESIDENT",
      qualifyingChildren: 2,
      spouseRelief: true,
    });
    expect(r.familyRelief).toBe(450_000);
    expect(r.tosBase).toBe(1_550_000);
    expect(r.tosAmount).toBe(2_500);
  });
});

describe("NSSF", () => {
  it("caps contributory wage at 1,200,000", () => {
    const n = calculateNssf(5_000_000);
    expect(n.contributoryWage).toBe(1_200_000);
    expect(n.pensionEe).toBe(24_000);
    expect(n.pensionEr).toBe(24_000);
    expect(n.healthEr).toBe(31_200);
    expect(n.riskEr).toBe(9_600);
    expect(n.employerTotal).toBe(64_800);
  });

  it("does not deduct NSSF from TOS", () => {
    const r = calculatePayroll({
      basic: 2_000_000,
      allowances: 0,
      overtime: 0,
      unpaidLeave: 0,
      fringeBenefits: 0,
      otherDeductions: 0,
      taxResidency: "RESIDENT",
      qualifyingChildren: 0,
      spouseRelief: false,
    });
    expect(r.tosBase).toBe(2_000_000);
    expect(r.net).toBe(r.gross - r.tosAmount - r.nssf.employeeTotal);
  });
});

describe("Overtime", () => {
  it("pays weekday OT at 150% of hourly basic", () => {
    // 2,600,000 / 26 / 8 = 12,500/h * 1.5 * 2h = 37,500
    expect(overtimePay(2_600_000, 26, 8, 2, 1.5)).toBe(37_500);
  });
});

describe("Prakas 442 Seniority Indemnity", () => {
  it("pays 7.5 days for a full UDC semester", () => {
    const r = calculateSeniority({
      hireDate: new Date("2026-01-01"),
      periodEndDate: new Date("2026-06-30"),
      averageMonthlyWageKhr: 2_600_000,
      contractType: "UDC",
    });
    expect(r.daysEarned).toBe(7.5);
    // 2,600,000 / 26 = 100,000 daily; 100,000 × 7.5 = 750,000
    expect(r.dailyWageKhr).toBe(100_000);
    expect(r.seniorityPayKhr).toBe(750_000);
    expect(r.tosAmount).toBe(0);
    expect(r.isFdcSeverance).toBe(false);
  });

  it("pro-rates for a partial first semester (3 months)", () => {
    const r = calculateSeniority({
      hireDate: new Date("2026-04-01"),
      periodEndDate: new Date("2026-06-30"),
      averageMonthlyWageKhr: 2_600_000,
      contractType: "UDC",
    });
    expect(r.daysEarned).toBe(3.8);
    expect(r.tosAmount).toBe(0);
  });

  it("returns zero for FDC employees (use Article 73 severance instead)", () => {
    const r = calculateSeniority({
      hireDate: new Date("2025-01-01"),
      periodEndDate: new Date("2026-06-30"),
      averageMonthlyWageKhr: 3_000_000,
      contractType: "FDC",
    });
    expect(r.daysEarned).toBe(0);
    expect(r.seniorityPayKhr).toBe(0);
    expect(r.isFdcSeverance).toBe(true);
    expect(r.fdcSeverancePct).toBe(0.05);
  });

  it("returns zero when employee has less than 1 month of service", () => {
    const r = calculateSeniority({
      hireDate: new Date("2026-06-20"),
      periodEndDate: new Date("2026-06-30"),
      averageMonthlyWageKhr: 2_000_000,
      contractType: "UDC",
    });
    expect(r.daysEarned).toBe(0);
    expect(r.seniorityPayKhr).toBe(0);
  });

  it("computes FDC Article 73 severance at 5%", () => {
    expect(fdcSeverance(12_000_000)).toBe(600_000);
  });
});
