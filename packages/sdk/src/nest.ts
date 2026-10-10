/**
 * NestJS entry: `import { IjnutModule } from '@ijnut/sdk/nest'`
 */
export { IjnutModule } from "./nest/module";
export type { IjnutModuleAsyncOptions } from "./nest/module";

export { IjnutController } from "./nest/controller";
export { IjnutMetricsMiddleware } from "./nest/metrics.middleware";
export { IjnutServiceKeyGuard } from "./nest/service-key.guard";
export { IJNUT_OPTIONS, IJNUT_STORE } from "./nest/tokens";

export type { CreateIjnutOptions } from "./create";

export {
  MetricsStore,
  defaultStore,
  withSpan,
  addSpan,
  tracedQuery,
  normalizeSql,
  parseAllowlist,
  runStress,
} from "@api-obs/observability";
