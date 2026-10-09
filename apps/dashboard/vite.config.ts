import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: resolve(import.meta.dirname, "../../.env"), override: true });

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    port: 3001,
    host: "127.0.0.1",
    // Local-only by default; Railway etc. don't use `vite dev`.
    allowedHosts: true
  },
  preview: {
    host: "0.0.0.0",
    port: 3001,
    // Required for vite preview behind Railway/Render public hostnames
    allowedHosts: true
  },
  plugins: [tanstackStart(), viteReact(), tailwindcss()],
});
