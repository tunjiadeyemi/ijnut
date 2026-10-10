import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import type { CreateIjnutOptions } from "../create";
import { extractServiceKey, resolveServiceKey } from "../service-key";
import { IJNUT_OPTIONS } from "./tokens";

@Injectable()
export class IjnutServiceKeyGuard implements CanActivate {
  constructor(
    @Inject(IJNUT_OPTIONS) private readonly options: CreateIjnutOptions,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = resolveServiceKey(this.options.serviceKey);
    if (!expected) {
      throw new UnauthorizedException(
        "OBSERVABILITY_SERVICE_KEY is not configured",
      );
    }

    const req = context.switchToHttp().getRequest<Request>();
    const provided = extractServiceKey(req);
    if (!provided || provided !== expected) {
      throw new UnauthorizedException(
        "Invalid or missing observability service key",
      );
    }
    return true;
  }
}
