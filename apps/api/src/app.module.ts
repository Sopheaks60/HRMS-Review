import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { resolve } from "node:path";
import { LoggerModule } from "nestjs-pino";
import { AuditInterceptor } from "./common/interceptors/audit.interceptor";
import { TenantContextInterceptor } from "./common/interceptors/tenant-context.interceptor";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { TenantGuard } from "./common/guards/tenant.guard";
import { PrismaModule } from "./prisma/prisma.module";
import { StorageModule } from "./storage/storage.module";
import { AuthModule } from "./modules/auth/auth.module";
import { TenantsModule } from "./modules/tenants/tenants.module";
import { RbacModule } from "./modules/rbac/rbac.module";
import { EmployeesModule } from "./modules/employees/employees.module";
import { OrganizationModule } from "./modules/organization/organization.module";
import { AttendanceModule } from "./modules/attendance/attendance.module";
import { BiometricModule } from "./modules/biometric/biometric.module";
import { LeaveModule } from "./modules/leave/leave.module";
import { OvertimeModule } from "./modules/overtime/overtime.module";
import { PayrollModule } from "./modules/payroll/payroll.module";
import { RecruitmentModule } from "./modules/recruitment/recruitment.module";
import { PerformanceModule } from "./modules/performance/performance.module";
import { LmsModule } from "./modules/lms/lms.module";
import { ExpensesModule } from "./modules/expenses/expenses.module";
import { AssetsModule } from "./modules/assets/assets.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { AuditModule } from "./modules/audit/audit.module";
import { BillingModule } from "./modules/billing/billing.module";
import { FilesModule } from "./modules/files/files.module";
import { HealthModule } from "./modules/health/health.module";
import { SettingsModule } from "./modules/settings/settings.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Resolve the shared workspace .env from both src/ and compiled dist/.
      envFilePath: resolve(__dirname, "../../../.env"),
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? "info",
        redact: ["req.headers.authorization", "req.headers.cookie"],
      },
    }),
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 120 }] }),
    EventEmitterModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.getOrThrow<string>("REDIS_URL") },
      }),
    }),
    PrismaModule,
    StorageModule,
    HealthModule,
    AuthModule,
    TenantsModule,
    RbacModule,
    OrganizationModule,
    EmployeesModule,
    AttendanceModule,
    BiometricModule,
    LeaveModule,
    OvertimeModule,
    PayrollModule,
    RecruitmentModule,
    PerformanceModule,
    LmsModule,
    ExpensesModule,
    AssetsModule,
    AnalyticsModule,
    NotificationsModule,
    AuditModule,
    BillingModule,
    FilesModule,
    SettingsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
