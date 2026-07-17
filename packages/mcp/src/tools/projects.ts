/**
 * Project tools (docs/features/mcp-server.md §5 + §3.4):
 *   - feedock_list_projects  (R)  the projects an ALL-PROJECTS token may target
 *   - feedock_select_project (~)  pick the session's project by id or slug
 *
 * These exist for USER-SCOPED tokens only. A project-bound token gets the API's
 * M-13 refusal from list ("bound to one project") and needs no selection at all.
 * A project whose MCP switch is off never appears in the list — "private to
 * MCP" means invisible — and selecting it by id fails the same way.
 *
 * The selection is a per-process CLAIM (see ProjectSession): the API
 * re-validates membership + the MCP switch on every subsequent call, so nothing
 * here is a security boundary — it is routing.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { MCP_PROJECTS_QUERY } from "../client/operations.js";
import { toApiToolError, toToolError } from "../lib/errors.js";
import { uuid } from "../schemas/index.js";
import type { ToolContext } from "./context.js";

interface McpProjectRow {
  id: string;
  name: string;
  slug: string;
}
interface McpProjectsData {
  mcpProjects: McpProjectRow[];
}

const ProjectItem = z.object({
  id: uuid,
  name: z.string(),
  slug: z.string(),
});

const ListProjectsOutput = {
  items: z.array(ProjectItem),
  selectedProjectId: uuid
    .nullable()
    .describe("the session's current selection, if any"),
} as const;

const SelectProjectInput = {
  id: uuid.optional().describe("the project id (or pass `slug`)"),
  slug: z
    .string()
    .min(1)
    .optional()
    .describe("the project slug (or pass `id`)"),
} as const;

const SelectProjectOutput = {
  project: ProjectItem.describe("every tool call now targets this project"),
} as const;

export function registerProjectTools(
  server: McpServer,
  ctx: ToolContext,
): void {
  const { client, session } = ctx;

  server.registerTool(
    "feedock_list_projects",
    {
      title: "List projects",
      description:
        "The projects this token can work in (all-projects tokens only — a " +
        "project-bound token is refused and needs no selection). Projects " +
        "with MCP access turned off are not listed. Read-only.",
      inputSchema: {},
      outputSchema: ListProjectsOutput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (): Promise<CallToolResult> => {
      try {
        const data = await client.request<McpProjectsData>(MCP_PROJECTS_QUERY);
        const out = {
          items: data.mcpProjects ?? [],
          selectedProjectId: session?.projectId ?? null,
        };
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
    "feedock_select_project",
    {
      title: "Select a project",
      description:
        "Point this session's tools at one project, by id or slug (see " +
        "feedock_list_projects). Every later call is still verified " +
        "server-side against your membership and the project's MCP switch. " +
        "Selection lasts until the MCP server restarts; call again to switch.",
      inputSchema: SelectProjectInput,
      outputSchema: SelectProjectOutput,
      annotations: {
        // Re-running with the same target is a no-op; not destructive (the
        // selection is routing, revalidated per call — never a grant).
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args): Promise<CallToolResult> => {
      if (!args.id && !args.slug) {
        return toToolError("Pass the project's `id` or `slug`.");
      }
      if (!session) {
        return toToolError(
          "This server has no project session — its token is project-bound, so no selection is needed.",
        );
      }
      try {
        const data = await client.request<McpProjectsData>(MCP_PROJECTS_QUERY);
        const projects = data.mcpProjects ?? [];
        const match = projects.find(
          (p) => p.id === args.id || p.slug === args.slug,
        );
        if (!match) {
          const names = projects.map((p) => `${p.name} (${p.slug})`).join(", ");
          return toolError(
            names.length > 0
              ? `No such project for this token. Available: ${names}.`
              : "No projects are available to this token (each may have MCP access turned off).",
          );
        }
        session.projectId = match.id;
        session.projectName = match.name;
        session.projectSlug = match.slug;
        const out = { project: match };
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

/** A handler-level safe message → the shared error result. */
function toolError(message: string): CallToolResult {
  const err = toToolError(message);
  return { isError: true, content: [...err.content] };
}
