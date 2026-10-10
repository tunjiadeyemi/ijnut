import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/hono.ts"],
  format: ["cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "node18",
  noExternal: ["@api-obs/observability"],
  external: ["express", "hono", "autocannon"],
});
