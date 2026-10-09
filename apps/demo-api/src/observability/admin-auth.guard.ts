import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";

/**
 * Fail-closed admin auth for /observability/* (except health).
 * Accepts Authorization: Bearer <token> or x-admin-key: <token>.
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.ADMIN_TOKEN;
    if (!expected) {
      throw new UnauthorizedException("ADMIN_TOKEN is not configured");
    }

    const req = context.switchToHttp().getRequest<Request>();
    const headerKey = req.header("x-admin-key");
    const auth = req.header("authorization");
    let provided: string | undefined = headerKey ?? undefined;

    if (!provided && auth?.toLowerCase().startsWith("bearer ")) {
      provided = auth.slice(7).trim();
    }

    if (!provided || provided !== expected) {
      throw new UnauthorizedException("Invalid or missing admin credentials");
    }

    return true;
  }
}
