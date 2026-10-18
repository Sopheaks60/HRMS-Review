import { describe, expect, it } from "vitest";
import { calculatePayroll } from "../../packages/shared/src/payroll/cambodia";

describe("e2e payroll fixture", () => {
  it("produces a balanced net for a typical Phnom Penh salary", () => {
    const r = calculatePayroll({
      basic: 2_050_000,
      allowances: 200_000,
      overtime: 37_500,
      unpaidLeave: 0,
      fringeBenefits: 0,
      otherDeductions: 0,
      taxResidency: "RESIDENT",
      qualifyingChildren: 1,
      spouseRelief: false,
    });
    expect(r.gross).toBe(2_287_500);
    expect(r.net).toBe(r.gross - r.tosAmount - r.nssf.employeeTotal);
    expect(r.nssf.contributoryWage).toBe(1_200_000);
  });
});
