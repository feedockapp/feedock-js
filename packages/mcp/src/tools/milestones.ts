/**
 * Milestone tools (docs/features/mcp-server.md §5 + §5.3):
 *   - feedock_list_milestones  (R)  milestones + derived progress %
 *   - feedock_get_milestone    (R)  detail: status, progress %, linked tasks +
 *                                   roadmap items + attached docs
 *   - feedock_create_milestone (+)  title/description?/status?/visibility?/owner?
 *                                   /startDate?/softTargetDate?(+precision)
 *                                   — PUBLIC needs confirm:true
 *   - feedock_update_milestone (~)  edit fields incl. the Planned→Active→Shipped
 *                                   lifecycle; needs confirm:true when the
 *                                   milestone IS or BECOMES PUBLIC
 *
 * The write pair closes the loop with `feedock_create_task` /
 * `feedock_update_task`, which already accept `milestoneId`: an agent can now
 * create the planning container AND group tasks under it without the dashboard.
 * Both writes are `@Roles(Owner, Admin)` + tenant-scoped server-side (the PAT
 * binds the project), and progress stays DERIVED — never settable here.
 *
 * M-27 friction: a PUBLIC milestone's title/status/live progress surface on the
 * public roadmap (transitive visibility), so a PUBLIC milestone is public copy.
 * Creating one PUBLIC needs confirm:true; UPDATING one needs confirm:true when it
 * IS or BECOMES public — the update reads the milestone's current visibility
 * rather than trusting the args, so editing already-published copy can't slip
 * through ungated (the feedock_update_roadmap_item reasoning).
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

import {
  CREATE_MILESTONE_MUTATION,
  MILESTONE_QUERY,
  MILESTONE_VISIBILITY_QUERY,
  MILESTONES_QUERY,
  UPDATE_MILESTONE_MUTATION,
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
  DatePrecisionEnum,
  DocTypeEnum,
  ListInputShape,
  listOutputShape,
  MilestoneItem,
  MilestoneStatusEnum,
  RoadmapColumnEnum,
  TaskPriorityEnum,
  TaskStatusEnum,
  uuid,
  VisibilityEnum,
  type DatePrecision,
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
  // The GraphQL Date scalar arrives as an ISO-8601 string over JSON.
  startDate: string | null;
  softTargetDate: string | null;
  softTargetPrecision: DatePrecision | null;
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
    startDate: m.startDate,
    softTargetDate: m.softTargetDate,
    softTargetPrecision: m.softTargetPrecision,
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

// Writes. `progressPct`/`taskCount`/`doneTaskCount` are DERIVED from the linked
// tasks (`round(done/total)`, Shipped pins 100%) — deliberately not settable, so
// a model can't fake progress. The planning dates ARE settable and round-trip:
// `MilestoneItem` reads them back, so a model can verify what it set.
const CreateMilestoneInputShape = {
  title: z.string().min(1).max(120).describe("the milestone title"),
  description: z
    .string()
    .optional()
    .describe(
      "optional description, in MARKDOWN — headings, **bold**, `code`, lists, [links](url). Converted to the dashboard's rich text, so write it for a person to read.",
    ),
  status: MilestoneStatusEnum.optional().describe(
    "defaults to Planned; Shipped pins progress to 100%",
  ),
  visibility: VisibilityEnum.optional().describe(
    "defaults to PRIVATE; PUBLIC surfaces the milestone's live progress on the public roadmap and requires confirm:true",
  ),
  ownerId: uuid.optional().describe("the owning member's user id"),
  startDate: z
    .string()
    .optional()
    .describe("ISO 8601 planned start, e.g. 2026-08-01"),
  softTargetDate: z
    .string()
    .optional()
    .describe(
      "ISO 8601 aspirational target — never enforced. For a fuzzy target pass the period's START date plus softTargetPrecision (2026-07-01 + Quarter reads as Q3 2026).",
    ),
  softTargetPrecision: DatePrecisionEnum.optional().describe(
    "how precise softTargetDate is; omit for a concrete day",
  ),
  confirm: z
    .boolean()
    .optional()
    .describe(
      "required (true) when visibility is PUBLIC — it is a public write",
    ),
} as const;

const UpdateMilestoneInputShape = {
  id: uuid.describe("the milestone id"),
  title: z.string().min(1).max(120).optional().describe("new title"),
  description: z
    .string()
    .nullable()
    .optional()
    .describe(
      "new description in MARKDOWN — REPLACES the whole description; null clears it",
    ),
  status: MilestoneStatusEnum.optional().describe(
    "move the lifecycle: Planned → Active → Shipped (Shipped pins progress to 100%)",
  ),
  visibility: VisibilityEnum.optional().describe(
    "setting PUBLIC surfaces live progress on the public roadmap and requires confirm:true",
  ),
  ownerId: uuid
    .nullable()
    .optional()
    .describe("new owner's user id; null clears the owner"),
  startDate: z
    .string()
    .nullable()
    .optional()
    .describe("ISO 8601 planned start; null clears it"),
  softTargetDate: z
    .string()
    .nullable()
    .optional()
    .describe(
      "ISO 8601 aspirational target (pass the period START for a fuzzy one); null clears it — and clears its precision with it",
    ),
  softTargetPrecision: DatePrecisionEnum.nullable()
    .optional()
    .describe(
      "how precise softTargetDate is; null resets it to a concrete day",
    ),
  confirm: z
    .boolean()
    .optional()
    .describe(
      "required (true) when setting visibility PUBLIC — a public write",
    ),
} as const;

/** What both write tools return — the created/updated milestone. */
const WriteMilestoneOutput = { milestone: MilestoneItem } as const;

/** The M-27 gate both write tools share: PUBLIC without confirm never reaches the API. */
const PUBLIC_MILESTONE_CONFIRM =
  "A PUBLIC milestone shows its live progress on the public roadmap — pass confirm:true (or use visibility:PRIVATE).";

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

  server.registerTool(
    "feedock_create_milestone",
    {
      title: "Create a milestone",
      description:
        "Create a planning milestone (a container that groups tasks, roadmap " +
        "items, and docs). Defaults to Planned + PRIVATE. PUBLIC surfaces its " +
        "live progress on the public roadmap, so it requires confirm:true. " +
        "Progress is derived from the linked tasks — group tasks under it with " +
        "feedock_create_task/feedock_update_task (milestoneId). Owner/Admin " +
        "only (the API enforces it). Returns the created milestone.",
      inputSchema: CreateMilestoneInputShape,
      outputSchema: WriteMilestoneOutput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args): Promise<CallToolResult> => {
      if (args.visibility === "PUBLIC" && args.confirm !== true) {
        return toolError(PUBLIC_MILESTONE_CONFIRM);
      }
      try {
        const input = {
          title: args.title,
          ...(args.description !== undefined
            ? { description: toRichTextHtml(args.description) }
            : {}),
          ...(args.status ? { status: args.status } : {}),
          ...(args.visibility ? { visibility: args.visibility } : {}),
          ...(args.ownerId ? { ownerId: args.ownerId } : {}),
          ...(args.startDate ? { startDate: args.startDate } : {}),
          ...(args.softTargetDate
            ? { softTargetDate: args.softTargetDate }
            : {}),
          ...(args.softTargetPrecision
            ? { softTargetPrecision: args.softTargetPrecision }
            : {}),
        };
        const data = await client.request<{ createMilestone: ApiMilestone }>(
          CREATE_MILESTONE_MUTATION,
          { input },
        );
        const out = { milestone: mapMilestone(data.createMilestone) };
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
    "feedock_update_milestone",
    {
      title: "Update a milestone",
      description:
        "Edit a milestone: title, description, owner, visibility, and the " +
        "Planned → Active → Shipped lifecycle (Shipped pins progress to 100%). " +
        "Only the fields you send change; description REPLACES the existing one " +
        "(null clears it). Editing a milestone that is (or becomes) PUBLIC " +
        "changes what the public roadmap shows, so it needs confirm:true. " +
        "Owner/Admin only. Returns the updated milestone.",
      inputSchema: UpdateMilestoneInputShape,
      outputSchema: WriteMilestoneOutput,
      annotations: {
        // Same-args re-run writes the same values: MilestoneService.update is a
        // plain field-set updateMany. Unlike the task-status tool's Done path it
        // stamps no timestamp and notifies no one — Shipped only pins progress at
        // READ time (deriveMilestoneProgress).
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args): Promise<CallToolResult> => {
      try {
        // The gate has to know whether this milestone is ALREADY public — when it
        // is, its title/status/progress are on the public roadmap, so ANY edit is
        // a public write even when the call says nothing about visibility.
        // Reading it (rather than trusting the args) is what keeps the common
        // case — editing published copy — from slipping through ungated, the same
        // reasoning as feedock_update_roadmap_item.
        const current = await client.request<{
          milestone: { visibility: Visibility } | null;
        }>(MILESTONE_VISIBILITY_QUERY, { id: args.id });
        if (!current.milestone) {
          return toolError("Milestone not found — check the id.");
        }
        const becomesPublic = args.visibility === "PUBLIC";
        const staysPublic =
          args.visibility === undefined &&
          current.milestone.visibility === "PUBLIC";
        if ((becomesPublic || staysPublic) && args.confirm !== true) {
          return toolError(
            becomesPublic
              ? PUBLIC_MILESTONE_CONFIRM
              : "This milestone is PUBLIC, so the edit changes what the public roadmap shows. Re-check the copy and retry with confirm:true.",
          );
        }

        const input = {
          id: args.id,
          ...(args.title !== undefined ? { title: args.title } : {}),
          // null clears the description; a string is markdown → rich text.
          ...(args.description !== undefined
            ? {
                description:
                  args.description === null
                    ? null
                    : toRichTextHtml(args.description),
              }
            : {}),
          ...(args.status ? { status: args.status } : {}),
          ...(args.visibility ? { visibility: args.visibility } : {}),
          ...(args.ownerId !== undefined ? { ownerId: args.ownerId } : {}),
          // Dates use the same null-clears / absent-untouched contract. Clearing
          // softTargetDate clears its precision server-side — a precision with no
          // target would read as a "Q4" that isn't there.
          ...(args.startDate !== undefined
            ? { startDate: args.startDate }
            : {}),
          ...(args.softTargetDate !== undefined
            ? { softTargetDate: args.softTargetDate }
            : {}),
          ...(args.softTargetPrecision !== undefined
            ? { softTargetPrecision: args.softTargetPrecision }
            : {}),
        };
        const data = await client.request<{ updateMilestone: ApiMilestone }>(
          UPDATE_MILESTONE_MUTATION,
          { input },
        );
        const out = { milestone: mapMilestone(data.updateMilestone) };
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
