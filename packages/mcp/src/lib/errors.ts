/**
 * Safe error shaping for the tool boundary (docs/features/mcp-server.md §5.3 + §6
 * rule 4). Tools **never throw** across the MCP boundary — every failure becomes
 * an `isError` result with an actionable, **secret-free** message. We map API
 * failures (HTTP 4xx / Apollo `extensions.code`) → a short, safe hint and
 * **never** leak a stack trace, SQL, or token.
 *
 * Reserve JSON-RPC protocol errors (`-32602` …) for unknown-tool / invalid-args /
 * server faults — those are thrown by the SDK, not by us.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ClientError } from "graphql-request";

/**
 * The MCP tool-result error shape. Note: **no** `structuredContent` on errors.
 *
 * This is the SDK's own `CallToolResult` — typing the error helpers with it (vs.
 * a bespoke interface) keeps the value **assignable at the tool boundary**: a
 * tool callback must return `CallToolResult`, whose object type carries an index
 * signature a hand-rolled `interface` would lack, so a custom error type can't be
 * returned directly from a handler.
 */
export type ToolErrorResult = CallToolResult;

/** Build the canonical safe error result from a message. */
export function toToolError(message: string): ToolErrorResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

/**
 * Apollo / NestJS surface auth + validation failures as GraphQL errors with an
 * `extensions.code`. We branch on that (and on the HTTP status for transport-level
 * failures) to produce a stable, safe message.
 */
const CODE_HINT: Record<string, string> = {
  UNAUTHENTICATED:
    "Authentication failed — your Feedock token may be revoked or expired. Generate a new one in Settings → API tokens.",
  FORBIDDEN:
    "You don't have permission to do that in this project (it may require an Owner/Admin role).",
  BAD_USER_INPUT:
    "The request was rejected as invalid — check the ids and field values.",
  NOT_FOUND: "Not found — check the id.",
};

/**
 * The **only** GraphQL `extensions.code`s for which the server's own message is
 * safe to surface verbatim. These are deliberate validation/authz/not-found
 * exceptions whose message is the most actionable thing we can show ("Feedback
 * abc is already merged into def…", "Feedback not found."). For **every other**
 * code — including `INTERNAL_SERVER_ERROR` and anything unmapped — the server
 * message may carry internals (Prisma/SQL text, a stack, a path), so we **never**
 * echo it and fall back to a generic code/status-mapped hint instead (§5.3,
 * §6 rule 4). The API also masks 5xx server-side; this is defense-in-depth.
 */
const SAFE_SERVER_MESSAGE_CODES = new Set([
  "BAD_USER_INPUT",
  "FORBIDDEN",
  "NOT_FOUND",
]);

/** HTTP status → safe hint (transport-level: a guard 401/403, a 404 route, etc.). */
function statusHint(status: number): string | null {
  if (status === 401) {
    return "Authentication failed — your Feedock token may be revoked or expired. Generate a new one in Settings → API tokens.";
  }
  if (status === 403) {
    return "You don't have permission to do that in this project (it may require an Owner/Admin role).";
  }
  if (status === 404) {
    return "Not found — check the id.";
  }
  if (status === 409) {
    return "That action conflicts with the current state — refresh and check the item first.";
  }
  if (status === 429) {
    return "Rate limit reached — wait a moment and try again.";
  }
  if (status >= 500) {
    return "The Feedock API had an internal error — try again shortly.";
  }
  return null;
}

/**
 * Extract the most specific GraphQL error message from a {@link ClientError},
 * sanitized to a single line and length-bounded so a verbose server message
 * can't smuggle internals into the model.
 */
function firstGraphQLMessage(err: ClientError): string | null {
  const errors = err.response?.errors;
  if (!Array.isArray(errors) || errors.length === 0) {
    return null;
  }
  const msg = errors[0]?.message;
  if (typeof msg !== "string" || msg.trim() === "") {
    return null;
  }
  return msg.replace(/\s+/g, " ").trim().slice(0, 240);
}

function firstGraphQLCode(err: ClientError): string | null {
  const errors = err.response?.errors;
  const code = errors?.[0]?.extensions?.["code"];
  return typeof code === "string" ? code : null;
}

/**
 * Map any thrown value from a GraphQL call → a safe, model-facing message.
 * Use as the single funnel: `client.request(...).catch(apiErrorMessage)` is too
 * coarse (it loses the typed catch), so handlers call this inside their own
 * try/catch and pass the result to {@link toToolError}.
 */
export function apiErrorMessage(err: unknown): string {
  if (err instanceof ClientError) {
    const status = err.response?.status ?? 0;
    const code = firstGraphQLCode(err);
    // Surface the server's own message ONLY for the allow-listed safe codes —
    // there it's the most actionable thing ("Feedback abc is already merged
    // into def…", "Feedback not found."). For any other code (incl.
    // INTERNAL_SERVER_ERROR / unmapped), the message may carry internals, so
    // never echo it: fall through to a generic code/status hint.
    if (code && SAFE_SERVER_MESSAGE_CODES.has(code)) {
      const serverMsg = firstGraphQLMessage(err);
      if (serverMsg) {
        return serverMsg;
      }
    }
    if (code && CODE_HINT[code]) {
      return CODE_HINT[code];
    }
    const byStatus = statusHint(status);
    if (byStatus) {
      return byStatus;
    }
    return "The Feedock API rejected the request.";
  }

  // Network / abort / unexpected — keep it generic; never echo the raw error.
  if (
    err instanceof Error &&
    /fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(err.message)
  ) {
    return "Could not reach the Feedock API — check FEEDOCK_API_URL and your connection.";
  }
  return "An unexpected error occurred talking to the Feedock API.";
}

/** Convenience: turn any thrown value directly into a {@link ToolErrorResult}. */
export function toApiToolError(err: unknown): ToolErrorResult {
  return toToolError(apiErrorMessage(err));
}
