# KromPay

Enterprise **HRMS + Cambodia payroll** SaaS.

| Layer | Stack |
| --- | --- |
| Web | Nuxt 4, Vue 3, TypeScript, Pinia, Tailwind, i18n km/en |
| API | NestJS, Prisma, PostgreSQL, Redis, BullMQ, MinIO |
| Mobile | Flutter (GPS + face ESS) |
| Payroll | Versioned TOS + NSSF engine (`@krompay/shared`) |

## Repository

```
apps/api          NestJS REST API + OpenAPI (`/api/docs`)
apps/web          Nuxt 4 console + employee self-service
apps/mobile       Flutter ESS
packages/prisma   Schema, SQL migrations, seed
packages/shared   Payroll engine, RBAC catalog, domain events
openapi           Canonical OpenAPI 3.1
infra/docker      Compose + Dockerfiles
infra/k8s         Kustomize base / dev / prod
docs              Architecture, payroll, security, deploy, runbook
tests             Unit, e2e, load placeholders
```

## Current implementation status

This repository is an active implementation, **not a production-ready or complete HRMS**. Implemented flows include API authentication, tenant-aware employee reads, GPS geofence punches, leave submission/approval, overtime submission/approval, Cambodia payroll calculation, payslip generation/download, ATS job and candidate stages, KPI cycles and updates, LMS enrollments and progress, expense approval, asset assignment, and queued SMTP/FCM notification delivery. API unit tests and API/web production builds have passed in the current workspace; live SMTP/FCM delivery and full system integration have not been validated here.

Still required for the requested enterprise release: RLS coverage and isolated-tenant tests for every tenant-owned table (currently enforced for Employee, Attendance, PayrollRun, and AuditLog); verified face enrollment and liveness; native ZKTeco ADMS integration; deeper ATS/KPI/LMS/expense/asset workflows; transactional outbox and live email/FCM integration validation; Stripe account and webhook integration validation; mobile release validation; observability, backup/restore, load and security testing; and production deployment hardening. See `docs/security.md` for current isolation limits.

The table below maps the original requirements to source areas. A listed source area does not imply the feature is complete.

1. Multi-tenant SaaS — `Tenant`, JWT `tid`, explicit query scoping; RLS still required  
2. RBAC — `Permission` / `Role` / guards  
3. Employee self-service — `/employees/me`, Nuxt `/ess`, Flutter  
4. Organization — branches, departments, positions, cost centers  
5. Attendance — WEB punches  
6. GPS attendance — geofence haversine  
7. Face selfie — capture, server-side provider verification, match/liveness threshold, private S3 storage, and verified attendance punch; provider enrollment/configuration still required  
8. ZKTeco — ADMS handshake/poll/ATTLOG/device-command acknowledgements; gateway-signed requests required and command provisioning is not implemented  
9. Leave — types, balances, approval  
10. Overtime — policy multipliers + approval  
11. Cambodia payroll engine — `@krompay/shared`  
12. Tax on Salary — Sub-Decree 48 brackets + family relief  
13. NSSF — risk / health / pension floors and ceilings  
14. Payroll workflow — calculate → approve → pay  
15. Payslip PDF — BullMQ + PDFKit  
16. ATS — jobs, candidates, stages  
17. KPI — cycles and assignments  
18. LMS — courses and enrollments  
19. Expenses — claims workflow  
20. Assets — tags and assignments  
21. Dashboard — `/analytics/dashboard`  
22. Email — BullMQ delivery worker via SMTP/Nodemailer; runtime provider validation required  
23. Push — push-token registration and FCM HTTP v1 worker; Firebase credentials and device delivery validation required  
24. Audit trail — interceptor + `AuditLog`  
25. Khmer + English — Nuxt i18n, bilingual names  
26. Subscriptions — tenant-scoped Stripe Checkout and customer portal; signature-verified, idempotent webhooks sync subscription periods and invoices; Stripe account setup and live event validation remain required  
27. REST + OpenAPI — Swagger + `openapi/krompay.yaml`  
28. Events — in-process events; durable outbox publisher not implemented  
29. Security — helmet, argon2, lockout, AES-GCM PII encryption and scoped access; PostgreSQL RLS not implemented  
30. Docker + Kubernetes — deployment scaffolding; production rollout not verified  

## Quick start

See [docs/deployment.md](docs/deployment.md).
