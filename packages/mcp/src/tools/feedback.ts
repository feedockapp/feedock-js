/**
 * Feedback tools (docs/features/mcp-server.md §5 + §5.3):
 *   - feedock_list_feedback              (R)  list + status/search/sort/limit
 *   - feedock_get_feedback               (R)  one item + its sanitized comments
 *   - feedock_update_feedback_status     (~)  Owner/Admin — re-fires the notify
 *   - feedock_convert_feedback_to_roadmap (+) Owner/Admin
 *   - feedock_convert_feedback_to_task    (+) Owner/Admin
 *   - feedock_add_feedback_comment        (+) any active member
 *   - feedock_merge_feedback              (!) Owner/Admin — friction (§5.1)
 *
 * Each handler maps validated input → a GraphQL document from `../client/operations`,
 * funnels every API failure through `lib/errors` (never throws across the MCP
 * boundary), and **sanitizes rich-text in the mapper** (`lib/sanitize`) before
 * building `structuredContent` + the JSON text block (the SDK discards transformed
 * output, so sanitizing in a schema `.transform` would ship raw HTML — §5.3).
 *
 * Tenancy + identity come from the PAT, never from a tool argument (§6 rule 1):
 * no handler accepts or forwards a project/user id.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import {
  ADD_FEEDBACK_COMMENT_MUTATION,
  CONVERT_FEEDBACK_TO_ROADMAP_MUTATION,
  CONVERT_FEEDBACK_TO_TASK_MUTATION,
  FEEDBACK_COMMENTS_QUERY,
  FEEDBACK_ITEM_QUERY,
  FEEDBACK_LIST_QUERY,
  MERGE_FEEDBACK_MUTATION,
  UPDATE_FEEDBACK_STATUS_MUTATION,
} from "../client/operations.js";
import {
  toApiToolError,
  toToolError,
  type ToolErrorResult,
} from "../lib/errors.js";
import { paginate } from "../lib/pagination.js";
import { sanitizeRichText } from "../lib/sanitize.js";
import {
  CommentItem,
  FeedbackItem,
  FeedbackSortEnum,
  ListInputShape,
  listOutputShape,
  MergeFeedbackInput,
  RoadmapColumnEnum,
  RoadmapItemShape,
  StatusEnum,
  TaskItem,
  TaskPriorityEnum,
  TaskStatusEnum,
  uuid,
  VisibilityEnum,
} from "../schemas/index.js";
import type { ToolContext } from "./context.js";

// --- Raw API row shapes (what the GraphQL documents select) ----------------
// The mapper projects these into the public-safe schema shapes; rich-text fields
// arrive RAW and are sanitized here before leaving the tool.

interface FeedbackRow {
  id: string;
  title: string;
  body?: string | null;
  status: string;
  kind: string;
  voteCount: number;
  requesterCount: number;
  visibility: string;
  roadmapItemId: string | null;
  createdAt: string;
}

interface CommentRow {
  id: string;
  body: string;
  isOfficial: boolean;
  authorName: string | null;
  createdAt: string;
}

interface RoadmapRow {
  id: string;
  title: string;
  description: string | null;
  column: string;
  visibility: string;
  targetWindow: string | null;
  milestoneId: string | null;
  peopleAsked: number;
  feedbackCount: number;
  taskCount: number;
  shippedAt: string | null;
}

interface TaskRow {
  id: string;
  number: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  milestoneId: string | null;
  roadmapItemId: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
}

// --- Mappers (project raw rows → public-safe, sanitized shapes) -------------

/** Project a feedback row; `sanitizeBody=false` for lists (body not selected). */
function mapFeedback(
  row: FeedbackRow,
  sanitizeBody: boolean,
): z.infer<typeof FeedbackItem> {
  return {
    id: row.id,
    title: row.title,
    body: sanitizeBody && row.body != null ? sanitizeRichText(row.body) : null,
    status: StatusEnum.parse(row.status),
    kind: row.kind as z.infer<typeof FeedbackItem>["kind"],
    voteCount: row.voteCount,
    requesterCount: row.requesterCount,
    visibility: VisibilityEnum.parse(row.visibility),
    roadmapItemId: row.roadmapItemId,
    createdAt: row.createdAt,
  };
}

/** Project + sanitize a comment row (each body is rich-text). */
function mapComment(row: CommentRow): z.infer<typeof CommentItem> {
  return {
    id: row.id,
    body: sanitizeRichText(row.body),
    isOfficial: row.isOfficial,
    authorName: row.authorName,
    createdAt: row.createdAt,
  };
}

/** Project + sanitize a roadmap-item row (description is rich-text). */
function mapRoadmap(row: RoadmapRow): z.infer<typeof RoadmapItemShape> {
  return {
    id: row.id,
    title: row.title,
    description:
      row.description != null ? sanitizeRichText(row.description) : null,
    column: RoadmapColumnEnum.parse(row.column),
    visibility: VisibilityEnum.parse(row.visibility),
    targetWindow: row.targetWindow,
    milestoneId: row.milestoneId,
    peopleAsked: row.peopleAsked,
    feedbackCount: row.feedbackCount,
    taskCount: row.taskCount,
    shippedAt: row.shippedAt,
  };
}

/** Project + sanitize a task row (description is rich-text). */
function mapTask(row: TaskRow): z.infer<typeof TaskItem> {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    description:
      row.description != null ? sanitizeRichText(row.description) : null,
    status: TaskStatusEnum.parse(row.status),
    priority: TaskPriorityEnum.parse(row.priority),
    assigneeId: row.assigneeId,
    milestoneId: row.milestoneId,
    roadmapItemId: row.roadmapItemId,
    dueDate: row.dueDate,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
  };
}

/** Wrap a mapped value into the dual-channel tool result (text + structured). */
function ok<T>(out: T): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(out) }],
    structuredContent: out as Record<string, unknown>,
  };
}

/**
 * Re-shape a (readonly-tuple) {@link ToolErrorResult} into a fresh, mutable
 * {@link CallToolResult} so the SDK's handler return type accepts it — the
 * shared error helpers return a `readonly` content tuple by design (no
 * `structuredContent` on errors), which is otherwise variance-incompatible.
 */
function fail(result: ToolErrorResult): CallToolResult {
  return { isError: true, content: [...result.content] };
}

// --- Tool input shapes (raw zod shapes; spread into registerTool) ----------

/** The board's `top`/`new` ordering → GraphQL `FeedbackSort` (`Top`/`New`). */
const SORT_TO_GQL: Record<z.infer<typeof FeedbackSortEnum>, string> = {
  top: "Top",
  new: "New",
};

const ListFeedbackInput = {
  status: StatusEnum.optional().describe("filter to one status"),
  sort: FeedbackSortEnum.optional()
    .default("top")
    .describe("board ordering: top (by votes) or new (by recency)"),
  ...ListInputShape,
} as const;

const GetFeedbackInput = {
  id: uuid.describe("the feedback item id"),
} as const;

const UpdateFeedbackStatusInputShape = {
  id: uuid.describe("the feedback item to triage"),
  status: StatusEnum.describe("the new user-facing status"),
} as const;

const ConvertFeedbackToRoadmapInput = {
  id: uuid.describe("the feedback item to convert"),
  column: RoadmapColumnEnum.optional().describe(
    "target lane (defaults server-side, typically Next)",
  ),
  visibility: VisibilityEnum.optional().describe(
    "roadmap-item visibility (defaults server-side to PUBLIC)",
  ),
  // M-27: convert defaults to a PUBLIC roadmap item whose title/body are copied
  // from the (untrusted) feedback, and it publicizes the feedback's status — a
  // public write. Require confirm:true unless the caller explicitly asks for a
  // PRIVATE item; enforced in the handler (conditional on visibility).
  confirm: z
    .boolean()
    .optional()
    .describe("required (true) unless visibility is PRIVATE — it is a public write"),
} as const;

const ConvertFeedbackToTaskInput = {
  id: uuid.describe("the feedback item to convert"),
  status: TaskStatusEnum.optional().describe("initial task status"),
  priority: TaskPriorityEnum.optional().describe("initial task priority"),
  milestoneId: uuid.optional().describe("attach the new task to a milestone"),
} as const;

const AddFeedbackCommentInput = {
  id: uuid.describe("the feedback item to reply on"),
  body: z
    .string()
    .min(1)
    .max(5000)
    .describe("the official member reply (plain text or rich-text HTML)"),
  // M-27: a comment posts a member-visible reply that surfaces on the public
  // portal — a write that prompt-injected feedback text must not trigger silently.
  // Require an explicit confirmation, mirroring merge_feedback/publish_changelog.
  confirm: z
    .literal(true)
    .describe(
      "explicit confirmation; a comment posts a publicly-visible reply — must be true",
    ),
} as const;

// --- Output shapes ---------------------------------------------------------

const ListFeedbackOutput = listOutputShape(FeedbackItem);

/** Detail output: the item + its sanitized comments. */
const GetFeedbackOutput = {
  feedback: FeedbackItem,
  comments: z.array(CommentItem),
} as const;

export function registerFeedbackTools(
  server: McpServer,
  ctx: ToolContext,
): void {
  const { client } = ctx;

  // --- feedock_list_feedback (R) -------------------------------------------
  server.registerTool(
    "feedock_list_feedback",
    {
      title: "List feedback",
      description:
        "List feedback for the connected project. Filter by status, free-text " +
        "search, and sort by top (votes) or new (recency). Returns id, title, " +
        "status, kind, vote/requester counts, and visibility — not bodies (use " +
        "feedock_get_feedback for one item's body + comments). `atCap` is true " +
        "when the API returned its 200-row cap, so more may exist.",
      inputSchema: ListFeedbackInput,
      outputSchema: ListFeedbackOutput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        const filter: Record<string, unknown> = {};
        if (args.status) {
          filter["status"] = args.status;
        }
        if (args.search) {
          filter["search"] = args.search;
        }
        filter["sort"] = SORT_TO_GQL[args.sort];
        const data = await client.request<{ feedbackList: FeedbackRow[] }>(
          FEEDBACK_LIST_QUERY,
          { filter },
        );
        const page = paginate(data.feedbackList, args.limit);
        const out = {
          items: page.items.map((row) => mapFeedback(row, false)),
          atCap: page.atCap,
        };
        return ok(out);
      } catch (err) {
        return fail(toApiToolError(err));
      }
    },
  );

  // --- feedock_get_feedback (R) --------------------------------------------
  server.registerTool(
    "feedock_get_feedback",
    {
      title: "Get feedback",
      description:
        "Fetch one feedback item by id with its full (sanitized) body and all " +
        "its comments (each comment body sanitized). Use after feedock_list_feedback " +
        "to read the details of a specific item before triaging or converting it.",
      inputSchema: GetFeedbackInput,
      outputSchema: GetFeedbackOutput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        const itemData = await client.request<{ feedbackItem: FeedbackRow }>(
          FEEDBACK_ITEM_QUERY,
          { id: args.id },
        );
        const commentData = await client.request<{
          feedbackComments: CommentRow[];
        }>(FEEDBACK_COMMENTS_QUERY, { feedbackId: args.id });
        const out = {
          feedback: mapFeedback(itemData.feedbackItem, true),
          comments: commentData.feedbackComments.map(mapComment),
        };
        return ok(out);
      } catch (err) {
        return fail(toApiToolError(err));
      }
    },
  );

  // --- feedock_update_feedback_status (~ — Owner/Admin) --------------------
  server.registerTool(
    "feedock_update_feedback_status",
    {
      title: "Update feedback status",
      description:
        "Set the user-facing status of a feedback item (Owner/Admin only). " +
        "Re-running this RE-DISPATCHES the status-change notification each time, " +
        "so it is NOT idempotent — only call it when the status actually changes. " +
        "Returns the updated item.",
      inputSchema: UpdateFeedbackStatusInputShape,
      outputSchema: { feedback: FeedbackItem },
      annotations: {
        readOnlyHint: false,
        // Re-firing the notify makes a repeat call NOT idempotent (§5.2).
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        const data = await client.request<{
          updateFeedbackStatus: FeedbackRow;
        }>(UPDATE_FEEDBACK_STATUS_MUTATION, {
          input: { feedbackId: args.id, status: args.status },
        });
        return ok({ feedback: mapFeedback(data.updateFeedbackStatus, false) });
      } catch (err) {
        return fail(toApiToolError(err));
      }
    },
  );

  // --- feedock_convert_feedback_to_roadmap (+ — Owner/Admin) ---------------
  server.registerTool(
    "feedock_convert_feedback_to_roadmap",
    {
      title: "Convert feedback to roadmap",
      description:
        "Promote a feedback item into a roadmap item in a lane (Now/Next/Later/" +
        "Shipped) — the loop's accept step (Owner/Admin only). The new roadmap " +
        "item links back to the feedback for the 'who asked' rollup. It defaults " +
        "to a PUBLIC item (copying the feedback's text to the public roadmap), so " +
        "pass confirm:true unless you set visibility:PRIVATE. Returns the created " +
        "roadmap item.",
      inputSchema: ConvertFeedbackToRoadmapInput,
      outputSchema: { roadmapItem: RoadmapItemShape },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        // M-27: a convert that isn't explicitly PRIVATE creates a PUBLIC roadmap
        // item from untrusted feedback text — require confirm:true.
        if (
          args.visibility !== VisibilityEnum.enum.PRIVATE &&
          args.confirm !== true
        ) {
          return fail(
            toToolError(
              "Converting feedback to a PUBLIC roadmap item copies its text to the " +
                "public roadmap and marks the feedback publicly. Re-check it and " +
                "retry with confirm:true (or set visibility:PRIVATE).",
            ),
          );
        }
        const input: Record<string, unknown> = { feedbackId: args.id };
        if (args.column) {
          input["column"] = args.column;
        }
        if (args.visibility) {
          input["visibility"] = args.visibility;
        }
        const data = await client.request<{
          convertFeedbackToRoadmap: RoadmapRow;
        }>(CONVERT_FEEDBACK_TO_ROADMAP_MUTATION, { input });
        return ok({ roadmapItem: mapRoadmap(data.convertFeedbackToRoadmap) });
      } catch (err) {
        return fail(toApiToolError(err));
      }
    },
  );

  // --- feedock_convert_feedback_to_task (+ — Owner/Admin) ------------------
  server.registerTool(
    "feedock_convert_feedback_to_task",
    {
      title: "Convert feedback to task",
      description:
        "Turn a feedback item into an internal task (Owner/Admin only) — the " +
        "loop's listen→build bridge. The new task seeds its title/description from " +
        "the feedback; status, priority, and milestone are optional overrides. " +
        "Returns the created task.",
      inputSchema: ConvertFeedbackToTaskInput,
      outputSchema: { task: TaskItem },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        const input: Record<string, unknown> = { feedbackId: args.id };
        if (args.status) {
          input["status"] = args.status;
        }
        if (args.priority) {
          input["priority"] = args.priority;
        }
        if (args.milestoneId) {
          input["milestoneId"] = args.milestoneId;
        }
        const data = await client.request<{
          convertFeedbackToTask: TaskRow;
        }>(CONVERT_FEEDBACK_TO_TASK_MUTATION, { input });
        return ok({ task: mapTask(data.convertFeedbackToTask) });
      } catch (err) {
        return fail(toApiToolError(err));
      }
    },
  );

  // --- feedock_add_feedback_comment (+ — any active member) ----------------
  server.registerTool(
    "feedock_add_feedback_comment",
    {
      title: "Add feedback comment",
      description:
        "Post an official member reply on a feedback item (any active member). " +
        "Use to respond to a requester or record a triage note. The reply is " +
        "publicly visible, so you MUST pass confirm:true (a write guard against " +
        "prompt-injected content). Returns the created comment (body sanitized).",
      inputSchema: AddFeedbackCommentInput,
      outputSchema: { comment: CommentItem },
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
          addFeedbackComment: CommentRow;
        }>(ADD_FEEDBACK_COMMENT_MUTATION, {
          input: { feedbackId: args.id, body: args.body },
        });
        return ok({ comment: mapComment(data.addFeedbackComment) });
      } catch (err) {
        return fail(toApiToolError(err));
      }
    },
  );

  // --- feedock_merge_feedback (! — Owner/Admin, friction §5.1) -------------
  server.registerTool(
    "feedock_merge_feedback",
    {
      title: "Merge feedback (destructive)",
      description:
        "Fold a duplicate feedback item into a canonical one (Owner/Admin only): " +
        "votes, follows, and comments move onto the canonical, and the duplicate " +
        "redirects. This is DESTRUCTIVE and not reversible. Server-side friction: " +
        "you must pass confirm:true AND expectedCanonicalTitle — the current title " +
        "of the canonical item — which is checked before folding (a race guard). " +
        "Returns the canonical item.",
      inputSchema: MergeFeedbackInput,
      outputSchema: { canonical: FeedbackItem },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        // Race guard (§5.1): re-fetch the canonical and verify its title matches
        // what the caller reviewed, BEFORE the irreversible fold. confirm:true is
        // enforced by the `z.literal(true)` input schema.
        const current = await client.request<{ feedbackItem: FeedbackRow }>(
          FEEDBACK_ITEM_QUERY,
          { id: args.canonicalId },
        );
        const actualTitle = current.feedbackItem.title;
        if (actualTitle !== args.expectedCanonicalTitle) {
          return fail(
            toToolError(
              `Canonical title mismatch — expected "${args.expectedCanonicalTitle}" ` +
                `but the item ${args.canonicalId} is now titled "${actualTitle}". ` +
                "Re-check the canonical item and retry with its current title.",
            ),
          );
        }
        const data = await client.request<{ mergeFeedback: FeedbackRow }>(
          MERGE_FEEDBACK_MUTATION,
          {
            // The GraphQL DTO names these sourceId/targetId (duplicate→canonical).
            input: { sourceId: args.duplicateId, targetId: args.canonicalId },
          },
        );
        return ok({ canonical: mapFeedback(data.mergeFeedback, false) });
      } catch (err) {
        return fail(toApiToolError(err));
      }
    },
  );
}
