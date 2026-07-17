/**
 * Tool catalog barrel (docs/features/mcp-server.md §5).
 *
 * Each loop-stage module exports a `registerXxxTools(server, ctx)` function (the
 * contract the parallel tools stage fills). This barrel re-exports them and a
 * `registerAllTools(server, ctx)` convenience that `server.ts` calls — so adding
 * a tool stays a one-line change here and never touches `server.ts`.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerChangelogTools } from "./changelog.js";
import type { ToolContext } from "./context.js";
import { registerDocTools } from "./docs.js";
import { registerFeedbackTools } from "./feedback.js";
import { registerMilestoneTools } from "./milestones.js";
import { registerOverviewTool } from "./overview.js";
import { registerProjectTools } from "./projects.js";
import { registerRoadmapTools } from "./roadmap.js";
import { registerTaskTools } from "./tasks.js";

export type { ToolContext } from "./context.js";
export {
  registerFeedbackTools,
  registerRoadmapTools,
  registerTaskTools,
  registerMilestoneTools,
  registerChangelogTools,
  registerDocTools,
  registerOverviewTool,
  registerProjectTools,
};

/** Register the full tool catalog on a server. */
export function registerAllTools(server: McpServer, ctx: ToolContext): void {
  registerFeedbackTools(server, ctx);
  registerRoadmapTools(server, ctx);
  registerTaskTools(server, ctx);
  registerMilestoneTools(server, ctx);
  registerChangelogTools(server, ctx);
  registerDocTools(server, ctx);
  registerOverviewTool(server, ctx);
  registerProjectTools(server, ctx);
}
