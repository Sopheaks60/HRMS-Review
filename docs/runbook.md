# Production runbook

## Health

- `GET /api/v1/health/live` — process up
- `GET /api/v1/health/ready` — PostgreSQL reachable

## Payroll failed mid-run

Runs are append-only. Mark the failed run `VOID` and recalculate. Do not edit `PayrollItem` in place.

## Statutory change (GDT / NSSF)

Insert a new `StatutoryTable` row with a later `effective` date. Never mutate historical rows (payslips must reproduce).

## ZKTeco device not punching

1. Confirm `BiometricDevice.serialNo` and `pushEnabled`.
2. Check HMAC secret on the device and API.
3. Inspect `BiometricPunch` vs unmatched `pin` (employee `biometricPin`).

## Tenant suspension

Set `Tenant.status = SUSPENDED`. Auth login rejects suspended/cancelled tenants.
