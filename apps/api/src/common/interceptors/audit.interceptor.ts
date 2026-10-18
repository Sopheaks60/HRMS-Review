import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { PrismaService } from "../../prisma/prisma.service";

const WRITE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    if (!WRITE.has(req.method) || !req.user?.tenantId) return next.handle();

    return next.handle().pipe(
      tap(async (result) => {
        try {
          await this.prisma.auditLog.create({
            data: {
              tenantId: req.user.tenantId,
              userId: req.user.userId,
              action: `${req.method} ${req.route?.path ?? req.path}`,
              entity: req.baseUrl?.split("/").pop() ?? "unknown",
              entityId: req.params?.id ?? null,
              ip: req.ip,
              userAgent: req.headers["user-agent"],
              after: result && typeof result === "object" ? { id: (result as { id?: string }).id } : undefined,
            },
          });
        } catch {
          // audit must never fail the request
        }
      }),
    );
  }
}
