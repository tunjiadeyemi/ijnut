import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { getObservabilityServiceKey } from "./service-key";

/**
 * Fail-closed auth for /observability/* (except health).
 * Accepts Authorization: Bearer <key>, x-observability-service-key, or legacy x-admin-key.
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = getObservabilityServiceKey();
    if (!expected) {
      throw new UnauthorizedException(
        "OBSERVABILITY_SERVICE_KEY is not configured",
      );
    }

    const req = context.switchToHttp().getRequest<Request>();
    const headerKey =
      req.header("x-observability-service-key") || req.header("x-admin-key");
    const auth = req.header("authorization");
    let provided: string | undefined = headerKey ?? undefined;

    if (!provided && auth?.toLowerCase().startsWith("bearer ")) {
      provided = auth.slice(7).trim();
    }

    if (!provided || provided !== expected) {
      throw new UnauthorizedException(
        "Invalid or missing observability service key",
      );
    }

    return true;
  }
}
