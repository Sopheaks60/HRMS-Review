# Cambodia payroll engine

Implementation: `packages/shared/src/payroll/cambodia.ts`  
Statutory payload: tenant-specific or global `StatutoryTable` (`kind = TOS_NSSF`), selected by the payroll period end date. If none exists, the engine falls back to its built-in `2026.1` table. The selected version is recorded in each payroll item's breakdown.

Payslip PDFs embed `apps/api/assets/fonts/Khmer.ttf` so Khmer text renders; its SIL Open Font License is included beside the font.

## Tax on Salary (resident)

Sub-Decree No. 48 (11 March 2024):

| Monthly taxable salary (KHR) | Rate |
| --- | --- |
| 0 – 1,500,000 | 0% |
| 1,500,001 – 2,000,000 | 5% |
| 2,000,001 – 8,500,000 | 10% |
| 8,500,001 – 12,500,000 | 15% |
| > 12,500,000 | 20% |

Relief (residents only): KHR 150,000 per qualifying child / month and KHR 150,000 for one household spouse.

Non-residents: **20% flat** on Cambodia-source salary (no family relief).  
Fringe benefits: **20% flat** on market value (separate from cash TOS).  
**NSSF is not deductible** from TOS.

## NSSF (2026 Phase 1)

| Scheme | Who pays | Rate | Contributory wage |
| --- | --- | --- | --- |
| Occupational risk | Employer | 0.8% | 200,000 – 1,200,000 |
| Healthcare | Employer | 2.6% | 200,000 – 1,200,000 |
| Pension | Employer 2% + employee 2% | 400,000 – 1,200,000 |

Phase 2 (planned Oct 2027): pension total **8%**. Keep this as a future `StatutoryTable` row; do not hard-code.

## Overtime (Labour Law defaults)

Configurable on `OvertimePolicy`: weekday 150%, night / rest / public holiday 200%, monthly cap 54 hours.

## Approval

`DRAFT → CALCULATED → PENDING_APPROVAL → APPROVED → PAID`  
Approval enqueues BullMQ `payslips` jobs that render bilingual PDF.
