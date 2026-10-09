import { config } from "dotenv";
import { resolve } from "node:path";
import express from "express";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { auth } from "./auth/auth";

// Local monorepo .env only — never override Compose/Railway-injected vars.
config({
  path: resolve(process.cwd(), "../../.env"),
  override: false,
});

async function bootstrap() {
  const { toNodeHandler } = await import("better-auth/node");

  const server = express();

  // Auth first — before any JSON body parser (OAuth + sign-in bodies).
  // Mount as middleware (no Express 5 `*` path syntax).
  server.use("/api/auth", toNodeHandler(auth));

  server.use(express.json({ limit: "2mb" }));
  server.use(express.urlencoded({ extended: true }));

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    bodyParser: false,
  });
  app.enableCors({
    origin: true,
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`demo-api listening on http://127.0.0.1:${port}`);
}

bootstrap();
