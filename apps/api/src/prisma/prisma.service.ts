import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { AsyncLocalStorage } from "node:async_hooks";

type TenantScope = {
  tenantId: string;
  tx?: Prisma.TransactionClient;
};

const MODEL_DELEGATES = new Set([
  "tenant", "featureFlag", "subscription", "stripeWebhookEvent", "invoice",
  "user", "session", "refreshToken", "pushToken", "role", "permission",
  "rolePermission", "userRole", "branch", "department", "position", "costCenter",
  "employee", "contract", "dependent", "geofence", "attendance", "faceSelfie",
  "biometricDevice", "biometricPunch", "leaveType", "leaveBalance", "leaveRequest",
  "overtimePolicy", "overtimeRequest", "statutoryTable", "payrollPeriod", "payrollRun",
  "payrollItem", "payslip", "jobRequisition", "candidate", "application", "interview",
  "kpiCycle", "kpiAssignment", "course", "courseEnrollment", "expenseClaim", "asset",
  "assetAssignment", "storedFile", "notification", "outboxEvent", "auditLog",
]);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly tenantScope = new AsyncLocalStorage<TenantScope>();

  constructor() {
    super();
    return new Proxy(this, {
      get: (target, property, receiver) => {
        const scope = target.tenantScope.getStore();
        if (!scope) return Reflect.get(target, property, receiver);

        if (property === "$transaction") {
          return (operation: ((client: Prisma.TransactionClient) => unknown) | unknown[]) => {
            if (scope.tx) {
              if (typeof operation === "function") return operation(scope.tx);
              throw new TypeError("Array-form Prisma transactions are unsupported inside a tenant-scoped request");
            }
            if (typeof operation !== "function") {
              throw new TypeError("Tenant-scoped Prisma transactions must use the callback form");
            }
            return target.$transaction(async (tx) => {
              await tx.$executeRaw`SELECT set_config('app.tenant_id', ${scope.tenantId}, true)`;
              return target.tenantScope.run({ ...scope, tx }, () => operation(tx));
            }, { maxWait: 10_000, timeout: 30_000 });
          };
        }

        if (typeof property !== "string" || !MODEL_DELEGATES.has(property)) {
          return Reflect.get(target, property, receiver);
        }
        if (scope.tx) {
          return (scope.tx as unknown as Record<string, unknown>)[property];
        }

        const delegate = Reflect.get(target, property, receiver) as object | undefined;
        if (!delegate || typeof delegate !== "object") return delegate;
        return new Proxy(delegate, {
          get: (modelDelegate, method, delegateReceiver) => {
            const operation = Reflect.get(modelDelegate, method, delegateReceiver);
            if (typeof method !== "string" || typeof operation !== "function") return operation;
            return (...args: unknown[]) => target.$transaction(async (tx) => {
              await tx.$executeRaw`SELECT set_config('app.tenant_id', ${scope.tenantId}, true)`;
              const txDelegate = (tx as unknown as Record<string, Record<string, (...values: unknown[]) => unknown>>)[property];
              const txOperation = txDelegate?.[method];
              if (typeof txOperation !== "function") throw new TypeError(`Unknown Prisma model operation: ${property}.${method}`);
              return txOperation.apply(txDelegate, args);
            }, { maxWait: 10_000, timeout: 30_000 });
          },
        });
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  runAsTenant<T>(tenantId: string, callback: () => T): T {
    return this.tenantScope.run({ tenantId }, callback);
  }

  async withTenant<T>(
    tenantId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return this.tenantScope.run({ tenantId, tx }, () => fn(tx));
    });
  }
}
