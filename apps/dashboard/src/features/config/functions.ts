import { createServerFn } from "@tanstack/react-start";

export const getDashboardConfig = createServerFn({ method: "GET" }).handler(
  async () => {
    const {
      DEFAULT_GATE_CTA,
      getIjnutMode,
      getIjnutPlan,
      getPublicApiUrl,
    } = await import("./server");
    return {
      publicApiUrl: getPublicApiUrl(),
      mode: getIjnutMode(),
      plan: getIjnutPlan(),
      cta: { ...DEFAULT_GATE_CTA },
    };
  },
);
