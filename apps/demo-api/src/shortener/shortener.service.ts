import {
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import Redis from "ioredis";
import { withSpan } from "@api-obs/observability";

const CACHE_PREFIX = "short:";
const CACHE_TTL_SEC = 60 * 60; // 1 hour

export interface ShortenResult {
  code: string;
  shortUrl: string;
  url: string;
}

@Injectable()
export class ShortenerService implements OnModuleInit, OnModuleDestroy {
  private pool!: Pool;
  private redis!: Redis;

  async onModuleInit(): Promise<void> {
    const databaseUrl =
      process.env.DATABASE_URL ??
      "postgres://postgres:postgres@127.0.0.1:5432/api_obs";
    const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

    this.pool = new Pool({ connectionString: databaseUrl });
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    await this.redis.connect();
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
    await withSpan(
      "db.insert.links",
      "db",
      () =>
        this.pool.query(`INSERT INTO links (code, url) VALUES ($1, $2)`, [
          code,
          url,
        ]),
      { sql: "INSERT INTO links (code, url) VALUES ($1, $2)" },
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

    if (!options.bypassCache) {
      const cached = await withSpan(
        "redis.get",
        "cache",
        () => this.redis.get(cacheKey),
        { key: "short:*" },
      );
      if (cached) {
        return { url: cached, cacheHit: true };
      }
    }

    const { rows } = await withSpan(
      "db.select.links",
      "db",
      () =>
        this.pool.query<{ url: string }>(
          `SELECT url FROM links WHERE code = $1`,
          [code],
        ),
      { sql: "SELECT url FROM links WHERE code = $1" },
    );
    const row = rows[0];
    if (!row) {
      throw new NotFoundException(`Unknown code: ${code}`);
    }

    if (!options.bypassCache) {
      await withSpan(
        "redis.setex",
        "cache",
        () => this.redis.setex(cacheKey, CACHE_TTL_SEC, row.url),
        { key: "short:*" },
      );
    }
    return { url: row.url, cacheHit: false };
  }

  async bustCache(code: string): Promise<void> {
    await withSpan("redis.del", "cache", () =>
      this.redis.del(`${CACHE_PREFIX}${code}`),
    );
  }

  async delete(code: string): Promise<void> {
    const result = await withSpan(
      "db.delete.links",
      "db",
      () => this.pool.query(`DELETE FROM links WHERE code = $1`, [code]),
      { sql: "DELETE FROM links WHERE code = $1" },
    );
    if (result.rowCount === 0) {
      throw new NotFoundException(`Unknown code: ${code}`);
    }
    await withSpan("redis.del", "cache", () =>
      this.redis.del(`${CACHE_PREFIX}${code}`),
    );
  }
}
