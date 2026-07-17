/**
 * Roadmap tools (docs/features/mcp-server.md §5 + §5.3):
 *   - feedock_list_roadmap        (R)  items by lane + peopleAsked + linked milestone
 *   - feedock_create_roadmap_item (+)  Owner/Admin → title · lane · milestone?
 *   - feedock_move_roadmap_item   (~)  Owner/Admin → move to a lane (re-Shipped
 *                                       rewrites shippedAt, so NOT idempotent yet)
 *
 * Each handler maps validated input → a GraphQL op (`../client/operations`),
 * funnels API errors through `lib/errors`, and **sanitizes rich-text in the
 * mapper** (`description`) before building `structuredContent` (§5.3). The PAT is
 * project-bound, so the client sends no project id; the API's role guards surface
 * an authz error for non-Owner/Admin callers on the write tools.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import {
  CREATE_ROADMAP_ITEM_MUTATION,
  MOVE_ROADMAP_ITEM_MUTATION,
  ROADMAP_ITEM_QUERY,
  ROADMAP_ITEMS_QUERY,
  UPDATE_ROADMAP_ITEM_MUTATION,
} from "../client/operations.js";
import { toApiToolError, toToolError } from "../lib/errors.js";
import { toRichTextHtml } from "../lib/markdown.js";
import { paginate } from "../lib/pagination.js";
import { sanitizeRichText } from "../lib/sanitize.js";
import {
  listOutputShape,
  RoadmapColumnEnum,
  RoadmapItemShape,
  uuid,
  VisibilityEnum,
} from "../schemas/index.js";
import type { ToolContext } from "./context.js";

// --- Raw GraphQL row shape (what `operations.ts` selects) ------------------

interface RoadmapItemRow {
  id: string;
  title: string;
  description: string | null;
  column: z.infer<typeof RoadmapColumnEnum>;
  visibility: z.infer<typeof VisibilityEnum>;
  targetWindow: string | null;
  milestoneId: string | null;
  peopleAsked: number;
  feedbackCount: number;
  taskCount: number;
  shippedAt: string | null;
}

/** Project a raw roadmap row → the public-safe item, sanitizing description. */
function mapRoadmapItem(row: RoadmapItemRow): z.infer<typeof RoadmapItemShape> {
  return {
    id: row.id,
    title: row.title,
    description:
      row.description == null ? null : sanitizeRichText(row.description),
    column: row.column,
    visibility: row.visibility,
    targetWindow: row.targetWindow,
    milestoneId: row.milestoneId,
    peopleAsked: row.peopleAsked,
    feedbackCount: row.feedbackCount,
    taskCount: row.taskCount,
    shippedAt: row.shippedAt,
  };
}

// --- Schemas ---------------------------------------------------------------

const ListRoadmapInput = {
  column: RoadmapColumnEnum.optional().describe(
    "filter to one lane (Now·Next·Later·Shipped); omit for all lanes",
  ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .default(50)
    .describe("max items to return; the API hard-caps at 200 regardless"),
} as const;

const ListRoadmapOutput = listOutputShape(RoadmapItemShape);

const CreateRoadmapItemToolInput = {
  title: z.string().min(1).max(200).describe("the roadmap item title"),
  column: RoadmapColumnEnum.optional().describe(
    "lane to place it in; defaults to Later when omitted",
  ),
  description: z
    .string()
    .max(10_000)
    .optional()
    .describe("rich-text or plain description"),
  visibility: VisibilityEnum.optional().describe(
    "PUBLIC shows on the public roadmap; defaults to the API's default",
  ),
  // M-27: creating a PUBLIC roadmap item is a public write — require an explicit
  // confirmation so prompt-injected feedback text can't silently post one. Not
  // needed for a PRIVATE (internal) item; enforced in the handler, not the schema,
  // because it's conditional on visibility.
  confirm: z
    .boolean()
    .optional()
    .describe("required (true) when visibility is PUBLIC — it is a public write"),
  targetWindow: z
    .string()
    .max(80)
    .optional()
    .describe('loose window e.g. "Q3" — never a hard date'),
  milestoneId: uuid
    .optional()
    .describe("down-link to a planning milestone (validated to this project)"),
} as const;

const UpdateRoadmapItemToolInput = {
  id: uuid.describe("the roadmap item to edit"),
  title: z.string().min(1).max(200).optional().describe("replace the title"),
  description: z
    .string()
    .max(10_000)
    .optional()
    .describe("replace the description — markdown, plain text, or rich-text HTML"),
  visibility: VisibilityEnum.optional().describe(
    "PUBLIC shows on the public roadmap",
  ),
  targetWindow: z
    .string()
    .max(80)
    .optional()
    .describe('loose window e.g. "Q3" — never a hard date'),
  milestoneId: uuid
    .optional()
    .describe("re-link to a planning milestone (validated to this project)"),
  // M-27: same reasoning as create — turning an item PUBLIC, or editing the copy
  // of one that already is, writes to the public roadmap. The lane is deliberately
  // NOT editable here: moving to Shipped emails requesters, and that gate lives in
  // feedock_move_roadmap_item where it can't be reached by an incidental edit.
  confirm: z
    .boolean()
    .optional()
    .describe("required (true) when the item is or becomes PUBLIC"),
} as const;

const MoveRoadmapItemToolInput = {
  id: uuid.describe("the roadmap item to move"),
  column: RoadmapColumnEnum.describe("the destination lane"),
  // M-27: moving a PUBLIC item to Shipped stamps shippedAt and fires irreversible
  // ship emails to the linked requesters — require confirm:true for that lane
  // (enforced in the handler; other lanes need none).
  confirm: z
    .boolean()
    .optional()
    .describe("required (true) when moving to Shipped — it emails requesters"),
} as const;

const RoadmapItemOutput = { item: RoadmapItemShape } as const;

// --- Registration ----------------------------------------------------------

export function registerRoadmapTools(
  server: McpServer,
  ctx: ToolContext,
): void {
  const { client } = ctx;

  server.registerTool(
    "feedock_list_roadmap",
    {
      title: "List roadmap items",
      description:
        "List public/private roadmap items, optionally filtered to one lane " +
        "(Now·Next·Later·Shipped). Each item carries peopleAsked (how many " +
        "requesters asked for it) and its linked milestone id. Read-only. Use " +
        "to see what's planned/shipped and the demand behind it. Returns " +
        "{ items, atCap }; atCap=true means the 200-row cap was hit and more may exist.",
      inputSchema: ListRoadmapInput,
      outputSchema: ListRoadmapOutput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args): Promise<CallToolResult> => {
      try {
        const data = await client.request<{ roadmapItems: RoadmapItemRow[] }>(
          ROADMAP_ITEMS_QUERY,
        );
        const rows =
          args.column == null
            ? data.roadmapItems
            : data.roadmapItems.filter((r) => r.column === args.column);
        // `atCap` is computed from the **unfiltered** API page (it caps before
        // the client-side column filter), not the filtered subset (§5).
        const page = paginate(
          rows.map(mapRoadmapItem),
          args.limit,
          data.roadmapItems.length,
        );
        return {
          content: [{ type: "text", text: JSON.stringify(page) }],
          structuredContent: page,
        };
      } catch (err) {
        return toApiToolError(err);
      }
    },
  );

  server.registerTool(
    "feedock_create_roadmap_item",
    {
      title: "Create a roadmap item",
      description:
        "Create a new roadmap item in a lane (Now·Next·Later·Shipped; defaults " +
        "to Later). Optionally down-link a planning milestone. Additive — it " +
        "does not change feedback. Owner/Admin only (the API returns a " +
        "permission error otherwise). A PUBLIC item posts to the public roadmap, " +
        "so pass confirm:true when visibility is PUBLIC (a write guard against " +
        "prompt-injected content). Returns the created item.",
      inputSchema: CreateRoadmapItemToolInput,
      outputSchema: RoadmapItemOutput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args): Promise<CallToolResult> => {
      try {
        const { confirm, ...rest } = args;
        // M-27: a PUBLIC roadmap item is a public write — require confirm:true.
        if (rest.visibility === VisibilityEnum.enum.PUBLIC && confirm !== true) {
          return toToolError(
            "Creating a PUBLIC roadmap item posts to the public roadmap. " +
              "Re-check the title/description and retry with confirm:true.",
          );
        }
        // Models write markdown; every Feedock rich-text surface stores HTML. Skip
        // this and the board shows literal `##` and backticks — the same bug the
        // other write tools fixed, in the one tool that was missed.
        const input = {
          ...rest,
          ...(rest.description !== undefined
            ? { description: toRichTextHtml(rest.description) }
            : {}),
        };
        const data = await client.request<{
          createRoadmapItem: RoadmapItemRow;
        }>(CREATE_ROADMAP_ITEM_MUTATION, { input });
        const out = { item: mapRoadmapItem(data.createRoadmapItem) };
        return {
          content: [{ type: "text", text: JSON.stringify(out) }],
          structuredContent: out,
        };
      } catch (err) {
        return toApiToolError(err);
      }
    },
  );

  server.registerTool(
    "feedock_update_roadmap_item",
    {
      title: "Update a roadmap item",
      description:
        "Edit a roadmap item's title, description, visibility, target window, " +
        "or linked milestone. Only the fields you pass change. Markdown in the " +
        "description is converted to rich text. Does NOT move lanes — use " +
        "feedock_move_roadmap_item, whose Shipped gate emails requesters. " +
        "Owner/Admin only. Editing an item that is (or becomes) PUBLIC writes to " +
        "the public roadmap, so it needs confirm:true. Returns the updated item.",
      inputSchema: UpdateRoadmapItemToolInput,
      outputSchema: RoadmapItemOutput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args): Promise<CallToolResult> => {
      try {
        const { confirm, ...rest } = args;

        // The gate has to know whether this item is ALREADY public — an edit to a
        // live public item is a public write even when the call says nothing about
        // visibility. Read it rather than assume; guessing from the args alone
        // would leave the common case (editing published copy) ungated.
        const current = await client.request<{ roadmapItem: RoadmapItemRow }>(
          ROADMAP_ITEM_QUERY,
          { id: rest.id },
        );
        const becomesPublic = rest.visibility === VisibilityEnum.enum.PUBLIC;
        const staysPublic =
          rest.visibility === undefined &&
          current.roadmapItem.visibility === VisibilityEnum.enum.PUBLIC;

        if ((becomesPublic || staysPublic) && confirm !== true) {
          return toToolError(
            becomesPublic
              ? "Making this roadmap item PUBLIC posts it to the public roadmap. " +
                  "Re-check the title/description and retry with confirm:true."
              : "This roadmap item is PUBLIC, so the edit changes the public " +
                  "roadmap. Re-check the copy and retry with confirm:true.",
          );
        }

        const input = {
          ...rest,
          ...(rest.description !== undefined
            ? { description: toRichTextHtml(rest.description) }
            : {}),
        };
        const data = await client.request<{
          updateRoadmapItem: RoadmapItemRow;
        }>(UPDATE_ROADMAP_ITEM_MUTATION, { input });
        const out = { item: mapRoadmapItem(data.updateRoadmapItem) };
        return {
          content: [{ type: "text", text: JSON.stringify(out) }],
          structuredContent: out,
        };
      } catch (err) {
        return toApiToolError(err);
      }
    },
  );

  server.registerTool(
    "feedock_move_roadmap_item",
    {
      title: "Move a roadmap item to a lane",
      description:
        "Move a roadmap item to a different lane (Now·Next·Later·Shipped). " +
        "Owner/Admin only. Moving to Shipped emails everyone who asked for it and " +
        "is not reversible, so that lane requires confirm:true. NOT idempotent: " +
        "re-moving an already-Shipped item to Shipped rewrites its shippedAt to " +
        "now, so avoid repeat calls. Returns the moved item.",
      inputSchema: MoveRoadmapItemToolInput,
      outputSchema: RoadmapItemOutput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args): Promise<CallToolResult> => {
      try {
        const { confirm, ...input } = args;
        // M-27: moving to Shipped emails the linked requesters (irreversible) —
        // require confirm:true for that lane.
        if (input.column === RoadmapColumnEnum.enum.Shipped && confirm !== true) {
          return toToolError(
            "Moving a roadmap item to Shipped emails everyone who asked for it " +
              "(and can't be undone). Re-check it and retry with confirm:true.",
          );
        }
        const data = await client.request<{ moveRoadmapItem: RoadmapItemRow }>(
          MOVE_ROADMAP_ITEM_MUTATION,
          { input },
        );
        const out = { item: mapRoadmapItem(data.moveRoadmapItem) };
        return {
          content: [{ type: "text", text: JSON.stringify(out) }],
          structuredContent: out,
        };
      } catch (err) {
        return toApiToolError(err);
      }
    },
  );
}
