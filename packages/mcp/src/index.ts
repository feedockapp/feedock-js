/**
 * `@feedock/mcp` — public entry point (docs/features/mcp-server.md §4).
 *
 * Exports the embeddable + testable {@link createServer} factory and the shared
 * schemas / client / tool-registration contract so Phase 2's remote NestJS module
 * can reuse the **same tool catalog + zod schemas** and only swap the data-access
 * layer (in-process service calls vs. HTTP).
 */

export { createServer, type CreateServerOptions } from "./server.js";
export {
  loadConfig,
  ConfigError,
  PAT_PREFIX,
  type FeedockConfig,
} from "./config.js";
export {
  createFeedockClient,
  type FeedockClient,
} from "./client/feedock-client.js";
export { SERVER_NAME, SERVER_VERSION } from "./version.js";

// Tool-registration contract (each module exports registerXxxTools(server, ctx)).
export {
  registerAllTools,
  registerFeedbackTools,
  registerRoadmapTools,
  registerTaskTools,
  registerMilestoneTools,
  registerChangelogTools,
  registerDocTools,
  registerOverviewTool,
  type ToolContext,
} from "./tools/index.js";

// Safe-error + pagination helpers (tools build their results with these).
export {
  toToolError,
  toApiToolError,
  apiErrorMessage,
  type ToolErrorResult,
} from "./lib/errors.js";
export {
  MAX_LIST_ROWS,
  DEFAULT_LIMIT,
  clampLimit,
  atCap,
  paginate,
} from "./lib/pagination.js";
export {
  sanitizeRichText,
  sanitizeDocHtml,
  type SafeHtml,
} from "./lib/sanitize.js";

// Shared zod schemas + enum tuples/types (reused by Phase 2).
export * from "./schemas/index.js";

// GraphQL documents the tools call.
export * as operations from "./client/operations.js";
