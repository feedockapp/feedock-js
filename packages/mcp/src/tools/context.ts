/**
 * The shared context every tool-register function receives — the data-access
 * handle plus anything the handlers need that isn't the `McpServer` itself.
 *
 * This is the **contract the parallel tools stage codes against**: each tool
 * module exports `registerXxxTools(server, ctx)`; the module never reaches for
 * a global — it pulls the GraphQL client off `ctx`. Phase 2's remote server
 * supplies a different `FeedockClient` behind the same `ToolContext`, so tool
 * modules are transport-agnostic.
 */

import type { FeedockClient } from "../client/feedock-client.js";
import type { ProjectSession } from "../client/project-session.js";

/** Context passed to every `registerXxxTools(server, ctx)`. */
export interface ToolContext {
  /** Data-access handle (Phase 1: GraphQL over HTTPS; Phase 2: in-process). */
  readonly client: FeedockClient;
  /**
   * The user-scoped token's selected project (written by
   * feedock_select_project, sent by the client as x-project-id). Absent when
   * the harness doesn't wire one; project-bound tokens never read it.
   */
  readonly session?: ProjectSession;
}
