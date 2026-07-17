/**
 * The per-process project selection a USER-SCOPED token works under. Written by
 * `feedock_select_project`, read by the client on every request (sent as
 * `x-project-id`). It is a CLAIM, not a grant: the API re-validates membership
 * and the project's MCP switch on every call, so a stale or hostile value can
 * never widen access. Project-bound tokens ignore it entirely — their project
 * comes from the token row and a disagreeing header is refused.
 */

/** Request header carrying the selected project (mirrors the API's constant). */
export const PROJECT_ID_HEADER = "x-project-id";

/** Mutable holder shared between the client and the project tools. */
export interface ProjectSession {
  projectId?: string;
  /** Display name of the selection, echoed in tool output for clarity. */
  projectName?: string;
  /** Slug of the selection — the human-recognizable handle. */
  projectSlug?: string;
}
