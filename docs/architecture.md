# KromPay architecture

KromPay is a multi-tenant HRMS and payroll application. API requests bind tenant identity from the authenticated JWT and tenant-owned queries must filter by `tenantId`; private object keys use tenant prefixes. PostgreSQL RLS policies are not installed yet, so database-level isolation is still a production requirement.

```
Flutter / Nuxt  --HTTPS-->  NestJS API  --> PostgreSQL
                                  |--> Redis / BullMQ
                                  |--> MinIO/S3
                                  |--> SMTP + FCM
ZKTeco devices --HMAC-->  /iclock/cdata
```

## Bounded contexts

| Module | Events | Notes |
| --- | --- | --- |
| Identity / RBAC | `user.invited` | Argon2id, refresh rotation, lockout, optional TOTP |
| Organization / employees | — | Tree of branch → department → position |
| Attendance | `attendance.punched` | WEB, GPS geofence, ZKTeco ingest; face capture/verification is not enabled |
| Leave / OT | `leave.*` `overtime.*` | WorkflowStatus |
| Payroll KH | `payroll.*` `payslip.generated` | Versioned statutory JSON |
| ATS / KPI / LMS / expenses / assets | domain events | Same tenant envelope |
| Billing | Stripe customer on tenant | Seat-based plans |
| Audit | interceptor on writes | Immutable `AuditLog` |

## Event-driven flow

1. Domain services persist and emit selected Nest `EventEmitter2` events (in-process).
2. `OutboxEvent` is modeled, but a durable outbox publisher is not wired yet.
3. BullMQ handles payslip generation and notification delivery. SMTP uses Nodemailer; push delivery uses Firebase Cloud Messaging HTTP v1 with a service-account JWT. Notification rows track the recipient, channel, read time, and successful delivery time; failed deliveries use exponential retry.
4. Event delivery to BullMQ is not backed by a transactional database outbox yet, so a process failure between the domain commit and queue insertion can lose a notification. Configure SMTP and FCM credentials before enabling delivery in production; local Compose routes SMTP to Mailpit.

## Cambodia payroll

See [payroll-cambodia.md](./payroll-cambodia.md). Calculation lives in `@krompay/shared` so API, tests, and future batch jobs share one engine.
