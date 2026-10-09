import { config } from "dotenv";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

// Local monorepo .env only — never override Compose/Railway-injected vars.
config({
  path: resolve(process.cwd(), "../../.env"),
  override: false,
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`demo-api listening on http://127.0.0.1:${port}`);
}

bootstrap();
