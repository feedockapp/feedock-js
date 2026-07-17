/**
 * Changelog tools (docs/features/mcp-server.md §5 + §5.3):
 *   - feedock_list_changelog            (R)  entries, optional client-side state
 *       filter over the capped page (the `changelogEntries` query takes no state
 *       arg and applies `take: CHANGELOG_LIST_CAP` (200) before any filter, so the
 *       filter is best-effort: complete only when the project has ≤200 entries).
 *   - feedock_create_changelog_draft    (+)  Owner/Admin → a Draft entry.
 *   - feedock_preview_changelog_publish (R)  Owner/Admin — the side-effect summary
 *       + `previewToken` + `firstPublish` from `changelogPublishPreview` (§5.1).
 *   - feedock_publish_changelog         (! ⊕) Owner/Admin — server-side friction
 *       (§5.1): requires `confirm:true` + the `previewToken` + `expectedFirstPublish`;
 *       passes them to `updateChangelogState`, which re-derives the token over the
 *       current effect set + first-publish state and rejects (`isError`) on mismatch.
 *
 * Every handler funnels API errors through `lib/errors` (`toApiToolError`) and
 * **sanitizes rich-text in the mapper** (`lib/sanitize`) before building
 * `structuredContent` (the SDK discards transformed output, so a schema
 * `.transform` would ship raw HTML — §5.3). GraphQL documents live in
 * `../client/operations`; the client sends no `x-project-id` (the PAT binds it).
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import {
  CHANGELOG_ENTRIES_QUERY,
  CHANGELOG_PUBLISH_PREVIEW_QUERY,
  CREATE_CHANGELOG_ENTRY_MUTATION,
  UPDATE_CHANGELOG_STATE_MUTATION,
} from "../client/operations.js";
import {
  toApiToolError,
  toToolError,
  type ToolErrorResult,
} from "../lib/errors.js";
import { toRichTextHtml } from "../lib/markdown.js";
import { paginate } from "../lib/pagination.js";
import { sanitizeRichText } from "../lib/sanitize.js";
import {
  CHANGELOG_STATE,
  ChangelogCategoryEnum,
  ChangelogItem,
  ChangelogStateEnum,
  ListInputShape,
  listOutputShape,
  PublishChangelogInput,
  PublishPreview,
  searchField,
  uuid,
  VisibilityEnum,
  type ChangelogState,
} from "../schemas/index.js";
import type { ToolContext } from "./context.js";

// --- Raw GraphQL row shapes -------------------------------------------------
// The dashboard GraphQL returns rich-text fields RAW; the mappers sanitize them
// before any output. Field names match `client/operations.ts` (body is aliased
// from `bodyMarkdown`; state filtering happens client-side).

interface ChangelogRow {
  id: string;
  title: string;
  body: string;
  whyItMatters: string | null;
  category: z.infer<typeof ChangelogCategoryEnum>;
  state: ChangelogState;
  visibility: z.infer<typeof VisibilityEnum>;
  slug: string;
  publishedAt: string | null;
  requesterCount: number;
}

interface PreviewRow {
  requesterCount: number;
  subscriberCount: number;
  roadmapItemCount: number;
  firstPublish: boolean;
  previewToken: string;
}

// --- Mappers (project to safe shape + sanitize rich-text) -------------------

/** Project + sanitize one entry row into the public-safe `ChangelogItem`. */
function mapChangelogEntry(row: ChangelogRow): z.infer<typeof ChangelogItem> {
  return {
    id: row.id,
    title: row.title,
    // Sanitize HERE (the mapper), not in a schema `.transform` (§5.3).
    body: sanitizeRichText(row.body ?? ""),
    whyItMatters: row.whyItMatters,
    category: row.category,
    state: row.state,
    visibility: row.visibility,
    slug: row.slug,
    publishedAt: row.publishedAt,
    requesterCount: row.requesterCount,
  };
}

function mapPreview(row: PreviewRow): z.infer<typeof PublishPreview> {
  return {
    requesterCount: row.requesterCount,
    subscriberCount: row.subscriberCount,
    roadmapItemCount: row.roadmapItemCount,
    firstPublish: row.firstPublish,
    previewToken: row.previewToken,
  };
}

/**
 * Best-effort client-side free-text match over a changelog row (title +
 * why-it-matters + body text). The dashboard `changelogEntries` query takes no
 * search argument, so — like the `state` filter — `search` is applied here over
 * the API's capped page (complete only for ≤200 entries; `atCap` flags a cap).
 * Body HTML tags are stripped first so the term matches visible text, not markup.
 */
function matchesChangelogSearch(row: ChangelogRow, term: string): boolean {
  const haystack = [
    row.title,
    row.whyItMatters ?? "",
    row.body.replace(/<[^>]*>/g, " "),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(term);
}

/**
 * Widen the shared `ToolErrorResult` (its `content` is a `readonly` tuple) into
 * the SDK's mutable `CallToolResult` so a handler can return either an error or a
 * success result from one Promise — copies the content into a fresh array, no
 * `structuredContent` (error results never carry one, §5.3).
 */
function errorResult(err: ToolErrorResult): CallToolResult {
  return { isError: true, content: [...err.content] };
}

/** API failure → the SDK error result (the `toApiToolError` funnel, widened). */
function apiError(err: unknown): CallToolResult {
  return errorResult(toApiToolError(err));
}

/** A handler-level safe message → the SDK error result. */
function toolError(message: string): CallToolResult {
  return errorResult(toToolError(message));
}

// --- Tool I/O schemas (raw zod shapes — §5.3) -------------------------------

/** `feedock_list_changelog` input: the shared list envelope + a state filter. */
const ListChangelogInput = {
  state: ChangelogStateEnum.optional().describe(
    "filter to one lifecycle state (Draft·Review·Published); applied client-side over the capped page",
  ),
  ...ListInputShape,
  // Override the shared `search` describe: changelog search is client-side
  // (the dashboard query takes no search arg), over title/why/body (§5/§6).
  search: searchField
    .optional()
    .describe(
      "free-text filter over the entry title, why-it-matters, and body; applied client-side over the capped page",
    ),
} as const;

const ListChangelogOutput = listOutputShape(ChangelogItem);

/** `feedock_create_changelog_draft` input (mirrors `CreateChangelogEntryInput`). */
const CreateChangelogDraftInput = {
  title: z.string().min(1).max(200).describe("the entry headline"),
  category: ChangelogCategoryEnum.optional().describe(
    "New · Improved · Fixed (defaults to New)",
  ),
  whyItMatters: z
    .string()
    .max(500)
    .optional()
    .describe("a short benefit line shown under the title"),
  body: z
    .string()
    .max(20000)
    .optional()
    .describe(
      "the entry body, in MARKDOWN — headings, **bold**, `code`, ```fenced blocks```, lists, [links](url). Converted to the dashboard's rich text; it is read by the founder's users, so write it for them.",
    ),
  visibility: VisibilityEnum.optional().describe(
    "PUBLIC or PRIVATE (defaults to PUBLIC)",
  ),
  milestoneId: uuid
    .optional()
    .describe("optional milestone to attach this entry to"),
  sourceFeedbackIds: z
    .array(uuid)
    .max(100)
    .optional()
    .describe('the feedback this entry announces ("who asked")'),
  roadmapItemIds: z
    .array(uuid)
    .max(100)
    .optional()
    .describe(
      "roadmap items this entry announces (moved to Shipped on publish)",
    ),
} as const;

const CreateChangelogDraftOutput = ChangelogItem.shape;

/** `feedock_preview_changelog_publish` input: just the entry id. */
const PreviewChangelogPublishInput = {
  id: uuid.describe("the changelog entry to preview publishing"),
} as const;

const PreviewChangelogPublishOutput = PublishPreview.shape;

const PublishChangelogOutput = ChangelogItem.shape;

// --- Registration -----------------------------------------------------------

export function registerChangelogTools(
  server: McpServer,
  ctx: ToolContext,
): void {
  const { client } = ctx;

  // ── feedock_list_changelog (R) ──────────────────────────────────────────
  server.registerTool(
    "feedock_list_changelog",
    {
      title: "List changelog entries",
      description:
        "List the project's changelog entries (newest first), optionally filtered to one lifecycle state (Draft·Review·Published) and/or a free-text search over title/why-it-matters/body. " +
        "Use it to see what's drafted, in review, or already published before drafting or publishing. " +
        "The state and search filters are applied client-side over the API's capped page, so they are complete only for projects with ≤200 entries (atCap signals a possible cap). " +
        "Returns { items, atCap } where each item is the public-safe entry projection (sanitized body, counts not emails).",
      inputSchema: ListChangelogInput,
      outputSchema: ListChangelogOutput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        const data = await client.request<{ changelogEntries: ChangelogRow[] }>(
          CHANGELOG_ENTRIES_QUERY,
        );
        const wantState = args.state as ChangelogState | undefined;
        const term = args.search?.trim().toLowerCase();
        // Client-side state + search filters over the capped page (best-effort; §5).
        let filtered = data.changelogEntries;
        if (wantState) {
          filtered = filtered.filter((e) => e.state === wantState);
        }
        if (term) {
          filtered = filtered.filter((e) => matchesChangelogSearch(e, term));
        }
        // atCap reflects the FULL fetched API page (it caps BEFORE these
        // client-side filters), not the post-filter subset — so pass the
        // unfiltered source length, never the filtered one (§5).
        const page = paginate(
          filtered,
          args.limit,
          data.changelogEntries.length,
        );
        const out = {
          items: page.items.map(mapChangelogEntry),
          atCap: page.atCap,
        };
        return {
          content: [{ type: "text", text: JSON.stringify(out) }],
          structuredContent: out,
        };
      } catch (error) {
        return apiError(error);
      }
    },
  );

  // ── feedock_create_changelog_draft (+) ──────────────────────────────────
  server.registerTool(
    "feedock_create_changelog_draft",
    {
      title: "Create a changelog draft",
      description:
        "Create a new changelog entry in the Draft state (it is never auto-published). " +
        "Use it to scaffold a 'what shipped' update; link the source feedback and roadmap items it announces so the publish step can email the right people and mark the roadmap Shipped. " +
        "Owner/Admin only — a member without that role gets a permission error. " +
        "Returns the created entry (Draft, sanitized body).",
      inputSchema: CreateChangelogDraftInput,
      outputSchema: CreateChangelogDraftOutput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        const data = await client.request<{
          createChangelogEntry: ChangelogRow;
        }>(CREATE_CHANGELOG_ENTRY_MUTATION, {
          input: {
            title: args.title,
            category: args.category,
            whyItMatters: args.whyItMatters,
            bodyMarkdown: args.body && toRichTextHtml(args.body),
            visibility: args.visibility,
            milestoneId: args.milestoneId,
            sourceFeedbackIds: args.sourceFeedbackIds,
            roadmapItemIds: args.roadmapItemIds,
          },
        });
        const out = mapChangelogEntry(data.createChangelogEntry);
        return {
          content: [{ type: "text", text: JSON.stringify(out) }],
          structuredContent: out,
        };
      } catch (error) {
        return apiError(error);
      }
    },
  );

  // ── feedock_preview_changelog_publish (R) ───────────────────────────────
  server.registerTool(
    "feedock_preview_changelog_publish",
    {
      title: "Preview a changelog publish",
      description:
        "Preview the side effects of publishing a changelog entry WITHOUT publishing: how many verified requesters + changelog subscribers would be emailed, how many linked roadmap items would move to Shipped, and whether this is a first publish (the only publish that emails anyone). " +
        "ALWAYS call this before feedock_publish_changelog: it returns a short-lived previewToken that binds the exact effect set, which the publish tool requires. " +
        "Owner/Admin only. Returns { requesterCount, subscriberCount, roadmapItemCount, firstPublish, previewToken }.",
      inputSchema: PreviewChangelogPublishInput,
      outputSchema: PreviewChangelogPublishOutput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        const data = await client.request<{
          changelogPublishPreview: PreviewRow;
        }>(CHANGELOG_PUBLISH_PREVIEW_QUERY, { id: args.id });
        const out = mapPreview(data.changelogPublishPreview);
        return {
          content: [{ type: "text", text: JSON.stringify(out) }],
          structuredContent: out,
        };
      } catch (error) {
        return apiError(error);
      }
    },
  );

  // ── feedock_publish_changelog (! ⊕) ─────────────────────────────────────
  server.registerTool(
    "feedock_publish_changelog",
    {
      title: "Publish a changelog entry",
      description:
        "Publish a changelog entry: stamps it Published and, ON FIRST PUBLISH ONLY, emails the verified requesters who asked + the project's changelog subscribers, and moves linked roadmap items to Shipped. THIS SENDS EMAIL and is not reversible — use with care. " +
        "You MUST first call feedock_preview_changelog_publish and pass its previewToken here plus confirm:true and expectedFirstPublish matching the preview's firstPublish flag. " +
        "The API re-derives the token over the current effect set (recipients, roadmap items, first-publish state) and rejects if anything changed since the preview — re-run the preview and retry if so. Owner/Admin only. Returns the published entry.",
      inputSchema: PublishChangelogInput,
      outputSchema: PublishChangelogOutput,
      annotations: {
        // Honest hints as a UX nicety; the real guard is the server-side
        // preview-token friction (§5.1), not these annotations.
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      // Client-side friction check: keep expectedFirstPublish honest against the
      // live preview BEFORE we attempt the publish, so a stale plan fails with an
      // actionable hint rather than a server token mismatch. The API is still
      // authoritative (it re-derives the token), this is a clearer early reject.
      try {
        const preview = await client.request<{
          changelogPublishPreview: PreviewRow;
        }>(CHANGELOG_PUBLISH_PREVIEW_QUERY, { id: args.id });
        if (
          preview.changelogPublishPreview.firstPublish !==
          args.expectedFirstPublish
        ) {
          return toolError(
            `expectedFirstPublish (${String(args.expectedFirstPublish)}) no longer matches the entry's state ` +
              `(firstPublish is now ${String(preview.changelogPublishPreview.firstPublish)}). ` +
              `Re-run feedock_preview_changelog_publish for a fresh previewToken, then retry.`,
          );
        }
      } catch (error) {
        return apiError(error);
      }

      try {
        const data = await client.request<{
          updateChangelogState: ChangelogRow;
        }>(UPDATE_CHANGELOG_STATE_MUTATION, {
          input: {
            id: args.id,
            state: CHANGELOG_STATE[2], // "Published"
            confirm: args.confirm,
            previewToken: args.previewToken,
          },
        });
        const out = mapChangelogEntry(data.updateChangelogState);
        return {
          content: [{ type: "text", text: JSON.stringify(out) }],
          structuredContent: out,
        };
      } catch (error) {
        return apiError(error);
      }
    },
  );
}
