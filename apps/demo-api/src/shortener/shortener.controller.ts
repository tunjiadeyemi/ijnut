import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpCode,
  Param,
  Post,
  Res,
  UnauthorizedException,
  ForbiddenException,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { ShortenerService } from "./shortener.service";
import { PublicRateLimitGuard } from "./public-rate-limit.guard";

function requireApiKey(apiKey: string | undefined): string {
  if (!apiKey) {
    throw new UnauthorizedException("Missing x-api-key");
  }
  return apiKey;
}

@Controller()
export class ShortenerController {
  constructor(private readonly shortener: ShortenerService) {}

  @Post("shorten")
  @HttpCode(201)
  @UseGuards(PublicRateLimitGuard)
  async shorten(
    @Body() body: { url?: string },
    @Headers("x-api-key") apiKey?: string,
  ) {
    // Optional demo auth: if SHORTEN_API_KEY is set, require it (401)
    const required = process.env.SHORTEN_API_KEY;
    if (required && apiKey !== required) {
      throw new UnauthorizedException("Missing or invalid x-api-key");
    }

    if (!body?.url || typeof body.url !== "string") {
      throw new BadRequestException("Body must include string url");
    }

    try {
      return await this.shortener.shorten(body.url);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : "Failed to shorten",
      );
    }
  }

  /** Force cache miss for the next redirect (demo / RESULTS scenarios). */
  @Post("shorten/:code/bust-cache")
  @HttpCode(204)
  async bust(
    @Param("code") code: string,
    @Headers("x-api-key") apiKey?: string,
  ) {
    const key = requireApiKey(apiKey);
    const admin = process.env.ADMIN_TOKEN ?? "change-me";
    const userKey = process.env.DEMO_USER_API_KEY ?? "demo-user";

    if (key === userKey) {
      throw new ForbiddenException(
        "User role cannot bust cache (admin only) — 403",
      );
    }
    if (key !== admin) {
      throw new UnauthorizedException("Invalid x-api-key");
    }
    await this.shortener.bustCache(code);
  }

  /**
   * Delete a short link.
   * - missing key → 401
   * - DEMO_USER_API_KEY → 403 (authorization: user cannot delete)
   * - ADMIN_TOKEN → 204
   */
  @Delete("shorten/:code")
  @HttpCode(204)
  async remove(
    @Param("code") code: string,
    @Headers("x-api-key") apiKey?: string,
  ) {
    const key = requireApiKey(apiKey);
    const admin = process.env.ADMIN_TOKEN ?? "change-me";
    const userKey = process.env.DEMO_USER_API_KEY ?? "demo-user";

    if (key === userKey) {
      throw new ForbiddenException(
        "User role cannot delete links (admin only) — 403",
      );
    }
    if (key !== admin) {
      throw new UnauthorizedException("Invalid x-api-key");
    }

    await this.shortener.delete(code);
  }

  /**
   * Redirect. Route pattern `/:code` normalizes in metrics.
   * Static routes (/health, /ping, …) win over this param route in Nest.
   */
  @Get(":code")
  @Header("X-Cache", "unknown")
  async redirect(
    @Param("code") code: string,
    @Headers("x-cache-mode") cacheMode: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const reserved = new Set([
      "health",
      "ping",
      "slow",
      "shorten",
      "observability",
      "admin",
      "items",
      "favicon.ico",
      "login",
    ]);
    if (reserved.has(code) || !/^[A-Za-z0-9_-]{4,16}$/.test(code)) {
      res.status(404).json({ message: "Not found" });
      return;
    }

    const bypassCache = cacheMode?.toLowerCase() === "bypass";
    const { url, cacheHit } = await this.shortener.resolve(code, {
      bypassCache,
    });
    res.setHeader("X-Cache", bypassCache ? "BYPASS" : cacheHit ? "HIT" : "MISS");
    res.redirect(302, url);
  }
}
