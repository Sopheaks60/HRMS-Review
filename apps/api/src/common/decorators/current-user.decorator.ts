import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export type AuthPrincipal = {
  userId: string;
  tenantId: string;
  permissions: string[];
  employeeId?: string;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthPrincipal => {
    return ctx.switchToHttp().getRequest().user as AuthPrincipal;
  },
);
