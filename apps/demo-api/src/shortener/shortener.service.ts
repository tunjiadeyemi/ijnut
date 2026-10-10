import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import Redis from "ioredis";
import { tracedQuery, withSpan } from "@api-obs/observability";

const CACHE_PREFIX = "short:";
const CACHE_TTL_SEC = 60 * 60; // 1 hour

export interface ShortenResult {
  code: string;
  shortUrl: string;
  url: string;
}

@Injectable()
export class ShortenerService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ShortenerService.name);
  private pool!: Pool;
  private redis: Redis | null = null;
  private redisReady = false;

  async onModuleInit(): Promise<void> {
    const databaseUrl =
      process.env.DATABASE_URL ??
      "postgres://postgres:postgres@127.0.0.1:5432/api_obs";
    const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

    this.pool = new Pool({ connectionString: databaseUrl });

    // Avoid crashing the process on Redis blips (ioredis emits 'error').
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
      retryStrategy: (times) => (times > 8 ? null : Math.min(times * 200, 2000)),
    });
    client.on("error", (err) => {
      this.redisReady = false;
      this.log.warn(`Redis error: ${err.message}`);
    });
    client.on("connect", () => {
      this.redisReady = true;
    });

    try {
      await client.connect();
      this.redis = client;
      this.redisReady = true;
      this.log.log(`Redis connected (${safeRedisHost(redisUrl)})`);
    } catch (err) {
      this.redisReady = false;
      await client.quit().catch(() => undefined);
      this.redis = null;
      this.log.warn(
        `Redis unavailable at ${safeRedisHost(redisUrl)} — cache bypassed. ` +
          `In Docker Compose set REDIS_URL=redis://redis:6379 (not 127.0.0.1). ` +
          `On Railway/Render attach a Redis plugin and set REDIS_URL.`,
      );
      if (err instanceof Error) this.log.warn(err.message);
    }

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS links (
        code TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis?.quit().catch(() => undefined);
    await this.pool?.end().catch(() => undefined);
  }

  async shorten(url: string): Promise<ShortenResult> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error("Invalid URL");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Only http/https URLs are supported");
    }

    const code = randomBytes(4).toString("base64url").slice(0, 6);
    await tracedQuery(
      this.pool,
      `INSERT INTO links (code, url) VALUES ($1, $2)`,
      [code, url],
      { name: "db.insert.links" },
    );

    const publicBase =
      process.env.DEMO_PUBLIC_URL ?? "http://127.0.0.1:3000";

    return {
      code,
      shortUrl: `${publicBase.replace(/\/$/, "")}/${code}`,
      url,
    };
  }

  async resolve(
    code: string,
    options: { bypassCache?: boolean } = {},
  ): Promise<{ url: string; cacheHit: boolean }> {
    const cacheKey = `${CACHE_PREFIX}${code}`;

    if (!options.bypassCache && this.redisReady && this.redis) {
      try {
        const cached = await withSpan(
          "redis.get",
          "cache",
          () => this.redis!.get(cacheKey),
          { key: "short:*" },
        );
        if (cached) {
          return { url: cached, cacheHit: true };
        }
      } catch {
        this.redisReady = false;
      }
    }

    const { rows } = await tracedQuery<{ rows: { url: string }[] }>(
      this.pool,
      `SELECT url FROM links WHERE code = $1`,
      [code],
      { name: "db.select.links" },
    );
    const row = rows[0];
    if (!row) {
      throw new NotFoundException(`Unknown code: ${code}`);
    }

    if (!options.bypassCache && this.redisReady && this.redis) {
      try {
        await withSpan(
          "redis.setex",
          "cache",
          () => this.redis!.setex(cacheKey, CACHE_TTL_SEC, row.url),
          { key: "short:*" },
        );
      } catch {
        this.redisReady = false;
      }
    }
    return { url: row.url, cacheHit: false };
  }

  async bustCache(code: string): Promise<void> {
    if (!this.redisReady || !this.redis) return;
    try {
      await withSpan("redis.del", "cache", () =>
        this.redis!.del(`${CACHE_PREFIX}${code}`),
      );
    } catch {
      this.redisReady = false;
    }
  }

  async delete(code: string): Promise<void> {
    const result = await tracedQuery<{ rowCount: number | null }>(
      this.pool,
      `DELETE FROM links WHERE code = $1`,
      [code],
      { name: "db.delete.links" },
    );
    if (result.rowCount === 0) {
      throw new NotFoundException(`Unknown code: ${code}`);
    }
    await this.bustCache(code);
  }
}

function safeRedisHost(redisUrl: string): string {
  try {
    const u = new URL(redisUrl);
    return `${u.hostname}:${u.port || "6379"}`;
  } catch {
    return "(invalid REDIS_URL)";
  }
}
