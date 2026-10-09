import { config } from "dotenv";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

// Monorepo root .env (cwd is apps/demo-api when using nest start)
config({ path: resolve(process.cwd(), "../../.env") });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`demo-api listening on http://127.0.0.1:${port}`);
}

bootstrap();
