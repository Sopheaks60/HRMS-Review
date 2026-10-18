# Security

- TLS everywhere (ingress). HSTS at the edge.
- Helmet, CORS allowlist, Nest ValidationPipe whitelist, throttling 120 req/min.
- Passwords: Argon2id. JWT access 15m, refresh 7d hashed at rest, rotated on use.
- Account lock after 8 failures (15 minutes).
- National IDs, NSSF numbers, and bank account numbers are encrypted with AES-256-GCM in the API using `PII_ENCRYPTION_KEY`; values use a versioned IV/tag/ciphertext envelope and are returned decrypted only from dedicated, permission-checked personal-data endpoints. The key is environment-injected today; production should source it from a KMS and define a key-rotation procedure before storing real PII.
- RBAC is applied to selected controllers; route-by-route authorization review is still required.
- Authenticated API requests establish transaction-local `app.tenant_id` for Prisma operations. PostgreSQL RLS with `FORCE ROW LEVEL SECURITY` is enabled for `Employee`, `Attendance`, `PayrollRun`, and `AuditLog`; all other tenant tables still rely on explicit tenant filters. Audit and payroll worker queries carry tenant context. Expand RLS coverage to every tenant-owned table and verify it with separate tenant roles before production.
- Audit interceptor on POST/PUT/PATCH/DELETE.
- ZKTeco devices do not sign requests with the app's HMAC. ADMS endpoints therefore require a trusted gateway that stamps `x-zk-timestamp` and signs `timestamp + "." + raw request body` with `BIOMETRIC_WEBHOOK_SECRET`; timestamps expire after five minutes. Do not expose these endpoints directly to the public internet. Device provisioning commands are not enabled.
- Face attendance rejects client-supplied scores, enforces server-side match and liveness thresholds, stores private selfies in S3, and rate-limits verification. Configure `FACE_VERIFICATION_URL` and `FACE_VERIFICATION_TOKEN` for a provider that verifies against an enrolled employee template; enrollment and provider-specific assurance must be completed before enabling face attendance in production.
- Face provider contract: authenticated JSON `POST` with `{ action: "verify", tenantId, employeeId, imageBase64 }`; return `{ verified: true, matchScore: 0..1, livenessScore: 0..1 }`. Both scores must be at least 0.85. The provider must securely map the employee to a previously enrolled template; do not accept scores from clients.
- Secrets only via Kubernetes Secret / sealed-secrets; never in images.
- Kubernetes manifests request non-root execution, a read-only API root filesystem, and resource limits; local Docker image execution has not been hardened to the same standard.
- Structured logs with authorization headers redacted (Pino).
