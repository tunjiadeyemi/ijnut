import type { Request, Response, NextFunction } from "express";

/** Preferred env + legacy ADMIN_TOKEN alias. */
export function resolveServiceKey(
  explicit?: string | null,
): string | undefined {
  const fromArg = explicit?.trim();
  if (fromArg) return fromArg;
  return (
    process.env.OBSERVABILITY_SERVICE_KEY?.trim() ||
    process.env.ADMIN_TOKEN?.trim() ||
    undefined
  );
}

export function extractServiceKey(req: Request): string | undefined {
  const header =
    req.header("x-observability-service-key") || req.header("x-admin-key");
  if (header?.trim()) return header.trim();

  const auth = req.header("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return undefined;
}

/** Express middleware — 401 unless the observability service key matches. */
export function requireServiceKey(expected: string | undefined) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!expected) {
      res.status(401).json({
        statusCode: 401,
        message: "OBSERVABILITY_SERVICE_KEY is not configured",
      });
      return;
    }
    const provided = extractServiceKey(req);
    if (!provided || provided !== expected) {
      res.status(401).json({
        statusCode: 401,
        message: "Invalid or missing observability service key",
      });
      return;
    }
    next();
  };
}
