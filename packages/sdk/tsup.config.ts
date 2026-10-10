import { defineConfig } from "tsup";

/**
 * Nest classes use explicit `@Inject(...)` tokens.
 * experimentalDecorators enabled via tsconfig for param decorators.
 */
export default defineConfig({
  entry: ["src/index.ts", "src/hono.ts", "src/nest.ts"],
  format: ["cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "node18",
  noExternal: ["@api-obs/observability"],
  external: [
    "express",
    "hono",
    "autocannon",
    "@nestjs/common",
    "@nestjs/core",
    "reflect-metadata",
    "rxjs",
  ],
  esbuildOptions(options) {
    options.tsconfig = "tsconfig.json";
  },
});
