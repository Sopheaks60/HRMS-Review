# Deployment

## Local

```bash
cp .env.example .env
docker compose -f infra/docker/docker-compose.yml up -d postgres redis minio mailpit
pnpm install
pnpm prisma:generate
pnpm --filter @krompay/prisma exec prisma migrate deploy
pnpm prisma:seed
pnpm --filter @krompay/api dev
pnpm --filter @krompay/web dev
```

API: http://localhost:4000/api/docs  
Web: http://localhost:3000  
Demo login: `owner@demo.krompay.app` / `ChangeMe!2026` / tenant `demo`

Generate a unique 32-byte PII encryption key for each deployment (for example, `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`) and provide it through a secret manager. Do not use the example key for real data. Back up the key and retain it during key rotation because encrypted database values cannot be recovered without it.

## Docker

```bash
docker compose -f infra/docker/docker-compose.yml up --build
```

## Kubernetes

```bash
kubectl apply -k infra/k8s/overlays/prod
```

Required secret `krompay-secrets`: `DATABASE_URL`, `REDIS_URL`, JWT secrets, `PII_ENCRYPTION_KEY`, S3 keys, SMTP, FCM, `BIOMETRIC_WEBHOOK_SECRET`. Route `/api/v1/iclock/*` through a trusted ADMS gateway that signs requests; do not expose device endpoints directly. For face attendance also set `FACE_VERIFICATION_URL` and `FACE_VERIFICATION_TOKEN` to the server-side provider; the verification page remains fail-closed when these are absent. Provider employee enrollment is required before verification can succeed.

For Stripe billing, configure `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and the Stripe Price IDs `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PROFESSIONAL`, and `STRIPE_PRICE_ENTERPRISE` in `.env` and the `krompay-secrets` Kubernetes Secret. Register `POST /api/v1/billing/webhook` in Stripe for `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, and `invoice.payment_failed`. The handler verifies the Stripe signature against the raw request body and records event IDs transactionally to make retries idempotent. Apply the Prisma migration before deploying this webhook code.

The face provider must accept authenticated JSON `POST` requests containing `action`, `tenantId`, `employeeId`, and `imageBase64`; for `action: "verify"` it must return `verified: true`, `matchScore`, and `livenessScore` in the 0–1 range. The API requires both scores to be at least 0.85. Use HTTPS and keep the token in the deployment secret.

CI (`.github/workflows/ci.yml`) builds API/web images, runs payroll unit tests, and kustomize-builds manifests.
