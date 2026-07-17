/**
 * Milestone tools (docs/features/mcp-server.md §5 + §5.3):
 *   - feedock_list_milestones (R)  milestones + derived progress %
 *   - feedock_get_milestone   (R)  detail: status, progress %, linked tasks +
 *                                  roadmap items + attached docs
 *
 * Contract (the same one every tool module follows):
 *   - raw zod input/output **shapes** (the SDK wraps them — never `z.object` here);
 *   - **all four** annotations set explicitly on every tool;
 *   - the mapper projects API rows → the public-safe shape and **sanitizes
 *     rich-text in the mapper** before building `structuredContent` (§5.3): the
 *     milestone's own `description` is rich-text (sanitized in {@link mapMilestone}).
 *     The `milestone(id)` detail sub-lists are narrow projections — the linked
 *     tasks carry no `description` and the attached docs are list rows (no `body`),
 *     so there is no further doc-bearing HTML to sanitize here; if a body-bearing
 *     field is ever added to these selections, sanitize it in {@link mapDoc} via
 *     `sanitizeDocHtml`;
 *   - lists return `{ items, atCap }` via `paginate` (capped at 200 server-side,
 *     so `atCap` is a lower-bound flag); the detail sub-lists are themselves
 *     `take: MAX_LIST_ROWS`-capped server-side (§5);
 *   - failures funnel through `toApiToolError` — we never throw across the boundary.
 *
 * Both tools are read-only; `milestones`/`milestone` are `GqlAuthGuard +
 * TenantGuard` (any active member). The PAT binds the project — the model supplies
 * no project id.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { MILESTONE_QUERY, MILESTONES_QUERY } from "../client/operations.js";
import {
  toApiToolError,
  toToolError,
  type ToolErrorResult,
} from "../lib/errors.js";
import { paginate } from "../lib/pagination.js";
import { sanitizeRichText } from "../lib/sanitize.js";
import {
  DocTypeEnum,
  ListInputShape,
  listOutputShape,
  MilestoneItem,
  RoadmapColumnEnum,
  TaskPriorityEnum,
  TaskStatusEnum,
  uuid,
  VisibilityEnum,
  type MilestoneStatus,
  type RoadmapColumn,
  type TaskPriority,
  type TaskStatus,
  type Visibility,
} from "../schemas/index.js";
import type { ToolContext } from "./context.js";

// --- Raw API row shapes (what operations.ts selects) ------------------------

interface ApiMilestone {
  id: string;
  title: string;
  description: string | null;
  status: MilestoneStatus;
  visibility: Visibility;
  progressPct: number;
  taskCount: number;
  doneTaskCount: number;
  ownerId: string | null;
}

interface ApiMilestoneTask {
  id: string;
  number: number;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
}

interface ApiMilestoneRoadmapItem {
  id: string;
  title: string;
  column: RoadmapColumn;
  visibility: Visibility;
}

interface ApiMilestoneDoc {
  id: string;
  title: string;
  slug: string;
  type: z.infer<typeof DocTypeEnum>;
  customTypeName: string | null;
  visibility: Visibility;
  updatedAt: string;
}

interface ApiMilestoneDetail extends ApiMilestone {
  tasks: ApiMilestoneTask[];
  roadmapItems: ApiMilestoneRoadmapItem[];
  docs: ApiMilestoneDoc[];
}

interface MilestonesData {
  milestones: ApiMilestone[];
}
interface MilestoneData {
  milestone: ApiMilestoneDetail | null;
}

// --- Error widening (shared `ToolErrorResult` → SDK `CallToolResult`) -------

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

// --- Mappers ----------------------------------------------------------------

function mapMilestone(m: ApiMilestone): z.infer<typeof MilestoneItem> {
  return {
    id: m.id,
    title: m.title,
    // Milestone descriptions are RichTextEditor-authored and stored raw by the
    // API — sanitize here in the mapper like roadmap/tasks/changelog do (§5.3).
    description: m.description == null ? null : sanitizeRichText(m.description),
    status: m.status,
    visibility: m.visibility,
    progressPct: m.progressPct,
    taskCount: m.taskCount,
    doneTaskCount: m.doneTaskCount,
    ownerId: m.ownerId,
  };
}

// --- I/O schemas ------------------------------------------------------------

const MilestoneTaskItem = z.object({
  id: uuid,
  number: z.number().int().describe('surfaced as "T-<number>"'),
  title: z.string(),
  status: TaskStatusEnum,
  priority: TaskPriorityEnum,
});

const MilestoneRoadmapItem = z.object({
  id: uuid,
  title: z.string(),
  column: RoadmapColumnEnum,
  visibility: VisibilityEnum,
});

const MilestoneDocItem = z.object({
  id: uuid,
  title: z.string(),
  slug: z.string(),
  type: DocTypeEnum,
  customTypeName: z
    .string()
    .nullable()
    .describe(
      "project-defined label; null when the legacy built-in type applies",
    ),
  visibility: VisibilityEnum,
  updatedAt: z.string().describe("ISO-8601"),
});

// The `milestones` query takes no `filter` — only `limit` applies (display-only
// client-side slicing of the capped page). Don't advertise a no-op `search`.
const ListMilestonesInput = {
  limit: ListInputShape.limit,
} as const;

const ListMilestonesOutput = listOutputShape(MilestoneItem);

const GetMilestoneInput = {
  id: uuid.describe("the milestone id"),
} as const;

const GetMilestoneOutput = {
  milestone: MilestoneItem.extend({
    tasks: z
      .array(MilestoneTaskItem)
      .describe("tasks grouped under this milestone"),
    roadmapItems: z
      .array(MilestoneRoadmapItem)
      .describe("roadmap items linked to this milestone"),
    docs: z.array(MilestoneDocItem).describe("docs attached to this milestone"),
  }),
} as const;

// --- Mapper for attached docs (after the schema it projects to) -------------

/**
 * Map an attached doc. The `milestone(id)` selection returns the doc **list**
 * projection (no `body`), so there is no rich-text to sanitize. Kept as a
 * dedicated mapper so a future body-bearing selection sanitizes via
 * `sanitizeDocHtml` in one place.
 */
function mapDoc(d: ApiMilestoneDoc): z.infer<typeof MilestoneDocItem> {
  return {
    id: d.id,
    title: d.title,
    slug: d.slug,
    type: d.type,
    customTypeName: d.customTypeName,
    visibility: d.visibility,
    updatedAt: d.updatedAt,
  };
}

// --- Registration -----------------------------------------------------------

export function registerMilestoneTools(
  server: McpServer,
  ctx: ToolContext,
): void {
  const { client } = ctx;

  server.registerTool(
    "feedock_list_milestones",
    {
      title: "List milestones",
      description:
        "List the project's planning milestones (Planned·Active·Shipped) with their derived progress %, task counts, owner, and visibility. Read-only. Returns up to 200 (the API cap) — `atCap=true` means more may exist; `limit` only narrows the returned page. Use `feedock_get_milestone` for one milestone's linked tasks/roadmap/docs.",
      inputSchema: ListMilestonesInput,
      outputSchema: ListMilestonesOutput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        const data = await client.request<MilestonesData>(MILESTONES_QUERY);
        const { items, atCap } = paginate(
          (data.milestones ?? []).map(mapMilestone),
          args.limit,
        );
        const out = { items, atCap };
        return {
          content: [{ type: "text", text: JSON.stringify(out) }],
          structuredContent: out,
        };
      } catch (err) {
        return apiError(err);
      }
    },
  );

  server.registerTool(
    "feedock_get_milestone",
    {
      title: "Get a milestone",
      description:
        "Fetch one milestone's detail: status, derived progress %, and its linked tasks, linked roadmap items, and attached docs (each a narrow projection). Read-only.",
      inputSchema: GetMilestoneInput,
      outputSchema: GetMilestoneOutput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        const data = await client.request<MilestoneData>(MILESTONE_QUERY, {
          id: args.id,
        });
        const m = data.milestone;
        if (!m) {
          return toolError("Milestone not found — check the id.");
        }
        const out = {
          milestone: {
            ...mapMilestone(m),
            tasks: (m.tasks ?? []).map((t) => ({
              id: t.id,
              number: t.number,
              title: t.title,
              status: t.status,
              priority: t.priority,
            })),
            roadmapItems: (m.roadmapItems ?? []).map((r) => ({
              id: r.id,
              title: r.title,
              column: r.column,
              visibility: r.visibility,
            })),
            docs: (m.docs ?? []).map(mapDoc),
          },
        };
        return {
          content: [{ type: "text", text: JSON.stringify(out) }],
          structuredContent: out,
        };
      } catch (err) {
        return apiError(err);
      }
    },
  );
}
