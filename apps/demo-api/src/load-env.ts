/**
 * Must be imported before any module that reads process.env at load time
 * (auth, AI, billing). Import statements are hoisted above dotenv calls in main.
 *
 * Order: app `.env` first (preferred), then repo-root `.env` only for missing keys.
 * `override: false` so Compose/Railway-injected vars always win.
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({
  path: resolve(process.cwd(), ".env"),
  override: false,
});
config({
  path: resolve(process.cwd(), "../../.env"),
  override: false,
});
