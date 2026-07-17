/**
 * Typed GraphQL client → `${FEEDOCK_API_URL}/graphql` with
 * `Authorization: Bearer <PAT>` (docs/features/mcp-server.md §4.2).
 *
 * A PROJECT-BOUND PAT needs no `x-project-id` — the API's `TenantGuard`
 * derives the project from the token (§3.3). A USER-SCOPED PAT picks its
 * project per session instead: `feedock_select_project` writes the choice into
 * the shared {@link ProjectSession}, and every request carries it as
 * `x-project-id` — a claim the API re-validates against membership and the
 * project's MCP switch on every call. One client is built at startup and
 * reused by every tool handler.
 *
 * The exported {@link FeedockClient} wraps `graphql-request`'s `GraphQLClient`
 * with a single `request` method that **catches API errors and rethrows the
 * original** (handlers funnel it through `apiErrorMessage` → `toToolError`, §5.3),
 * keeping the call sites thin and the error surface uniform.
 */

import { GraphQLClient, type Variables } from "graphql-request";

import type { FeedockConfig } from "../config.js";
import { PROJECT_ID_HEADER, type ProjectSession } from "./project-session.js";

/**
 * The data-access handle every tool module receives. Phase 2's remote server
 * supplies a different implementation (in-process service calls) behind the same
 * interface, so tool modules never depend on the transport.
 */
export interface FeedockClient {
  /**
   * Execute a GraphQL document. Throws on failure (a `graphql-request`
   * `ClientError` or a network error) — the caller maps it to a safe tool error.
   */
  request<TData = unknown, TVars extends Variables = Variables>(
    document: string,
    variables?: TVars,
  ): Promise<TData>;
}

/**
 * Build the singleton GraphQL client from validated config.
 *
 * `extraHeaders` are merged onto every request — the remote (Phase 2) server
 * passes an internal loopback marker so its own `/graphql` calls are
 * distinguishable from an external token replay. The stdio path passes none.
 */
export function createFeedockClient(
  config: FeedockConfig,
  extraHeaders?: Record<string, string>,
  /** Session-selected project (user-scoped tokens); absent = project-bound. */
  session?: ProjectSession,
): FeedockClient {
  const gql = new GraphQLClient(config.graphqlUrl, {
    // PAT is the Bearer; lowercase `authorization` per the spec snippet. A
    // project-bound token needs no x-project-id (it comes from the token).
    headers: { authorization: `Bearer ${config.apiToken}`, ...extraHeaders },
  });

  return {
    request<TData = unknown, TVars extends Variables = Variables>(
      document: string,
      variables?: TVars,
    ): Promise<TData> {
      // `graphql-request`'s overloads accept (document, variables); the cast
      // keeps our generic surface tidy without leaking its overload union.
      const projectId = session?.projectId;
      return gql.request<TData>(
        document,
        variables as Variables | undefined,
        projectId ? { [PROJECT_ID_HEADER]: projectId } : undefined,
      );
    },
  };
}
