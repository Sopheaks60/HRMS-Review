import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ user?: { tenantId?: string } }>();
    const tenantId = request.user?.tenantId;
    if (!tenantId) return next.handle();
    return new Observable((subscriber) =>
      this.prisma.runAsTenant(tenantId, () => next.handle().subscribe(subscriber)),
    );
  }
}
