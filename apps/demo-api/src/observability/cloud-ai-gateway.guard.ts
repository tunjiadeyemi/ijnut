import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { getIjnutMode } from "./ai-quota";
import { getObservabilityServiceKey } from "./service-key";

function extractProvidedKey(req: Request): string | undefined {
  const headerKey =
    req.header("x-observability-service-key") || req.header("x-admin-key");
  if (headerKey?.trim()) return headerKey.trim();
  const auth = req.header("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return undefined;
}

/**
 * Gateway for Cloud AI product routes (AI + billing + auth config).
 *
 * - Valid OBSERVABILITY_SERVICE_KEY → always allowed (hosted BFF / ops).
 * - IJNUT_MODE=cloud with no key → allowed; handlers enforce login/quota via session.
 * - selfhost → service key required (same as metrics API).
 *
 * Customers using your Cloud AI URL from a local dashboard only need to sign in —
 * they do not need IJNUT_CLOUD_AI_SERVICE_KEY.
 */
@Injectable()
export class CloudAiGatewayGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const expected = getObservabilityServiceKey();
    const provided = extractProvidedKey(req);

    if (provided && expected && provided === expected) {
      return true;
    }

    if (provided && expected && provided !== expected) {
      throw new UnauthorizedException(
        "Invalid or missing observability service key",
      );
    }

    if (getIjnutMode() === "cloud") {
      return true;
    }

    if (!expected) {
      throw new UnauthorizedException(
        "OBSERVABILITY_SERVICE_KEY is not configured",
      );
    }

    throw new UnauthorizedException(
      "Invalid or missing observability service key",
    );
  }
}
