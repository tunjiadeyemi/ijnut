import { config } from "dotenv";
import { resolve } from "node:path";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { auth } from "./auth/auth";
import { ensureAuthSchema } from "./auth/auth-db-check";
import { mountBachsWebhook } from "./billing/mount-bachs-webhook";

// Env load order (never override Compose/Railway-injected vars):
// 1) repo-root .env (monorepo convenience)
// 2) apps/demo-api/.env (preferred for this service)
config({
  path: resolve(process.cwd(), "../../.env"),
  override: false,
});
config({
  path: resolve(process.cwd(), ".env"),
  override: false,
});

async function bootstrap() {
  const { toNodeHandler } = await import("better-auth/node");
  const authHandler = toNodeHandler(auth);

  const server = express();

  // Auth before Nest + JSON parser. Match on originalUrl so Express does not
  // strip `/api/auth` (better-auth needs the full path).
  server.use((req: Request, res: Response, next: NextFunction) => {
    const path = (req.originalUrl || req.url || "").split("?")[0];
    if (!path.startsWith("/api/auth")) {
      next();
      return;
    }

    void Promise.resolve(authHandler(req, res)).catch((err: unknown) => {
      console.error("[auth] handler failed", err);
      if (!res.headersSent) {
        const message =
          err instanceof Error ? err.message : "Auth handler failed";
        res.status(500).json({
          statusCode: 500,
          message,
          code: "AUTH_HANDLER_ERROR",
        });
      }
    });
  });

  // Bachs webhook needs raw body for HMAC — before express.json().
  mountBachsWebhook(server);

  server.use(express.json({ limit: "2mb" }));
  server.use(express.urlencoded({ extended: true }));

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    bodyParser: false,
  });
  app.enableCors({
    origin: true,
    credentials: true,
  });

  await ensureAuthSchema();

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`demo-api listening on http://127.0.0.1:${port}`);
}

bootstrap().catch((err) => {
  console.error("[demo-api] failed to start", err);
  process.exit(1);
});
