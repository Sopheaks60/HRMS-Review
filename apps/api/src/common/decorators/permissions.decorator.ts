import { SetMetadata } from "@nestjs/common";
import type { PermissionCode } from "@krompay/shared";

export const PERMISSIONS_KEY = "permissions";
export const RequirePermissions = (...codes: PermissionCode[]) =>
  SetMetadata(PERMISSIONS_KEY, codes);
