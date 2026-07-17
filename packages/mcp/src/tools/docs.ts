/**
 * Doc tools (docs/features/mcp-server.md §5 + §5.3):
 *   - feedock_list_docs  (R)  typed docs list (filter by type) → safe list items
 *   - feedock_get_doc    (R)  one doc + body, **sanitized via sanitizeDocHtml**
 *   - feedock_create_doc (+)  title/type?/body?/visibility?/milestone? — PUBLIC needs confirm:true
 *   - feedock_update_doc (~)  edit fields; body REPLACES; setting PUBLIC needs confirm:true
 *   - feedock_delete_doc (!)  confirm:true; irreversible (annotations cascade with it)
 *
 * Docs are internal team artifacts; any active member may read them (the API
 * enforces per-doc Restricted access; creating is gated by the project's
 * docCreateRole, enforced server-side). The read tools are read-only. Every
 * tool that returns a body sanitizes the rich-text **in the mapper** (the SDK
 * discards transformed output, so a schema `.transform` would ship raw HTML —
 * §5.3) before building `structuredContent`.
 *
 * M-27 friction: a PUBLIC doc renders on the public portal, so creating one —
 * or flipping one PUBLIC — is a public write that prompt-injected content must
 * not trigger silently. Both paths require confirm:true, mirroring
 * convert_feedback_to_roadmap's conditional gate.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import {
  CREATE_DOC_MUTATION,
  DELETE_DOC_MUTATION,
  DOC_QUERY,
  DOCS_QUERY,
  UPDATE_DOC_MUTATION,
} from "../client/operations.js";
import { toApiToolError, toToolError } from "../lib/errors.js";
import { toRichTextHtml } from "../lib/markdown.js";
import { paginate } from "../lib/pagination.js";
import { sanitizeDocHtml } from "../lib/sanitize.js";
import {
  DocItem,
  DocListItem,
  DocTypeEnum,
  listOutputShape,
  uuid,
  VisibilityEnum,
} from "../schemas/index.js";
import type { ToolContext } from "./context.js";

// --- Raw GraphQL row shapes (what `operations.ts` selects) -----------------

interface DocListRow {
  id: string;
  title: string;
  slug: string;
  type: z.infer<typeof DocTypeEnum>;
  customTypeName: string | null;
  visibility: z.infer<typeof VisibilityEnum>;
  milestoneId: string | null;
  updatedAt: string;
}

interface DocRow extends DocListRow {
  body: string;
}

function mapDocListItem(row: DocListRow): z.infer<typeof DocListItem> {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    type: row.type,
    customTypeName: row.customTypeName,
    visibility: row.visibility,
    milestoneId: row.milestoneId,
    updatedAt: row.updatedAt,
  };
}

/** Project a raw doc row → the safe detail, sanitizing the rich-text body. */
function mapDocItem(row: DocRow): z.infer<typeof DocItem> {
  return { ...mapDocListItem(row), body: sanitizeDocHtml(row.body) };
}

// --- Schemas ---------------------------------------------------------------

const ListDocsInput = {
  type: DocTypeEnum.optional().describe(
    "filter to one doc type (Prd·TechNote·LaunchChecklist·DecisionLog·" +
      "CustomerResearch·MeetingNotes·Freeform)",
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

const ListDocsOutput = listOutputShape(DocListItem);

const GetDocInput = { id: uuid.describe("the doc id") } as const;

const GetDocOutput = { doc: DocItem } as const;

const CreateDocInputShape = {
  title: z.string().min(1).max(200).describe("the doc title"),
  type: DocTypeEnum.optional().describe(
    "Prd·TechNote·LaunchChecklist·DecisionLog·CustomerResearch·MeetingNotes·Freeform (defaults to Freeform)",
  ),
  body: z
    .string()
    .optional()
    .describe(
      "the doc body, in MARKDOWN — headings, **bold**, `code`, ```fenced blocks```, lists, > quotes, [links](url). Converted to the dashboard's rich text, so write it for a person to read.",
    ),
  visibility: VisibilityEnum.optional().describe(
    "defaults to PRIVATE; PUBLIC puts the doc on the public portal and requires confirm:true",
  ),
  milestoneId: uuid.optional().describe("attach to this milestone"),
  confirm: z
    .boolean()
    .optional()
    .describe(
      "required (true) when visibility is PUBLIC — it is a public write",
    ),
} as const;

const UpdateDocInputShape = {
  id: uuid.describe("the doc id"),
  title: z.string().min(1).max(200).optional().describe("new title"),
  type: DocTypeEnum.optional().describe("new doc type"),
  body: z
    .string()
    .optional()
    .describe(
      "the doc body, in MARKDOWN — REPLACES the whole document; read it first with feedock_get_doc and send the full edited text",
    ),
  visibility: VisibilityEnum.optional().describe(
    "setting PUBLIC puts the doc on the public portal and requires confirm:true",
  ),
  milestoneId: uuid
    .nullable()
    .optional()
    .describe("attach to this milestone; null detaches"),
  confirm: z
    .boolean()
    .optional()
    .describe(
      "required (true) when setting visibility PUBLIC — a public write",
    ),
} as const;

const DeleteDocInputShape = {
  id: uuid.describe("the doc id"),
  // Deletion is irreversible (annotations cascade with the doc) and reachable
  // from untrusted doc text via prompt injection — explicit confirmation (§5.1).
  confirm: z
    .literal(true)
    .describe("explicit confirmation; deletion is permanent — must be true"),
} as const;

const DeleteDocOutput = {
  deleted: z.literal(true),
  id: uuid.describe("the deleted doc id"),
} as const;

/** The M-27 gate both write tools share: PUBLIC without confirm never reaches the API. */
const PUBLIC_DOC_CONFIRM =
  "Making a doc PUBLIC publishes it on the portal — pass confirm:true (or use visibility:PRIVATE).";

// --- Registration ----------------------------------------------------------

export function registerDocTools(server: McpServer, ctx: ToolContext): void {
  const { client } = ctx;

  server.registerTool(
    "feedock_list_docs",
    {
      title: "List docs",
      description:
        "List the project's typed docs (PRDs, tech notes, decision logs, …), " +
        "optionally filtered by type. Read-only; returns lightweight list items " +
        "(no body) as { items, atCap }. Use feedock_get_doc for a doc's body. " +
        "atCap=true means the 200-row cap was hit and more may exist.",
      inputSchema: ListDocsInput,
      outputSchema: ListDocsOutput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args): Promise<CallToolResult> => {
      try {
        const filter = args.type == null ? undefined : { type: args.type };
        const data = await client.request<{ docs: DocListRow[] }>(DOCS_QUERY, {
          filter,
        });
        const page = paginate(data.docs.map(mapDocListItem), args.limit);
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
    "feedock_get_doc",
    {
      title: "Get a doc",
      description:
        "Fetch one doc by id, including its sanitized rich-text body. Read-only. " +
        "Use after feedock_list_docs to read a specific PRD/note/decision log. " +
        "Returns { doc }.",
      inputSchema: GetDocInput,
      outputSchema: GetDocOutput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args): Promise<CallToolResult> => {
      try {
        const data = await client.request<{ doc: DocRow }>(DOC_QUERY, {
          id: args.id,
        });
        const out = { doc: mapDocItem(data.doc) };
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
    "feedock_create_doc",
    {
      title: "Create a doc",
      description:
        "Create a typed doc (PRD, tech note, decision log, …). Defaults to " +
        "Freeform + PRIVATE. PUBLIC visibility puts the doc on the public " +
        "portal, so it requires confirm:true. Creating may be role-gated by " +
        "the project (docCreateRole) — the API enforces it. Returns the " +
        "created doc.",
      inputSchema: CreateDocInputShape,
      outputSchema: GetDocOutput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args): Promise<CallToolResult> => {
      if (args.visibility === "PUBLIC" && args.confirm !== true) {
        return toToolError(PUBLIC_DOC_CONFIRM);
      }
      try {
        const input = {
          title: args.title,
          ...(args.type ? { type: args.type } : {}),
          ...(args.body !== undefined
            ? { body: toRichTextHtml(args.body) }
            : {}),
          ...(args.visibility ? { visibility: args.visibility } : {}),
          ...(args.milestoneId ? { milestoneId: args.milestoneId } : {}),
        };
        const data = await client.request<{ createDoc: DocRow }>(
          CREATE_DOC_MUTATION,
          { input },
        );
        const out = { doc: mapDocItem(data.createDoc) };
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
    "feedock_update_doc",
    {
      title: "Update a doc",
      description:
        "Edit a doc's title, type, body, visibility, or milestone. The body " +
        "REPLACES the whole document — read it first with feedock_get_doc and " +
        "send the full edited HTML. Setting visibility PUBLIC publishes the " +
        "doc on the portal and requires confirm:true. Omitted fields stay " +
        "untouched; milestoneId null detaches. Returns the updated doc.",
      inputSchema: UpdateDocInputShape,
      outputSchema: GetDocOutput,
      annotations: {
        // Same-args re-run writes the same values.
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args): Promise<CallToolResult> => {
      if (args.visibility === "PUBLIC" && args.confirm !== true) {
        return toToolError(PUBLIC_DOC_CONFIRM);
      }
      try {
        const input = {
          id: args.id,
          ...(args.title !== undefined ? { title: args.title } : {}),
          ...(args.type ? { type: args.type } : {}),
          ...(args.body !== undefined
            ? { body: toRichTextHtml(args.body) }
            : {}),
          ...(args.visibility ? { visibility: args.visibility } : {}),
          ...(args.milestoneId !== undefined
            ? { milestoneId: args.milestoneId }
            : {}),
        };
        const data = await client.request<{ updateDoc: DocRow }>(
          UPDATE_DOC_MUTATION,
          { input },
        );
        const out = { doc: mapDocItem(data.updateDoc) };
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
    "feedock_delete_doc",
    {
      title: "Delete a doc",
      description:
        "Permanently delete a doc and its annotations. Irreversible; requires " +
        "confirm:true. Prefer setting visibility PRIVATE over deleting unless " +
        "the human explicitly asked for deletion.",
      inputSchema: DeleteDocInputShape,
      outputSchema: DeleteDocOutput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args): Promise<CallToolResult> => {
      try {
        await client.request<{ deleteDoc: boolean }>(DELETE_DOC_MUTATION, {
          id: args.id,
        });
        const out = { deleted: true as const, id: args.id };
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
