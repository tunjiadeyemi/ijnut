/** Paths that are safe / useful to hammer on the Nest demo API. */
export const DEMO_PATHS = [
  { method: "GET", path: "/ping", label: "GET /ping" },
  { method: "GET", path: "/slow", label: "GET /slow (deliberate delay)" },
  { method: "GET", path: "/health", label: "GET /health" },
  { method: "GET", path: "/items/42", label: "GET /items/42" },
  { method: "POST", path: "/admin/echo", label: "POST /admin/echo (expect 401)" },
] as const;
