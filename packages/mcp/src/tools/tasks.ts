/**
 * Task tools (docs/features/mcp-server.md §5 + §5.3):
 *   - feedock_list_tasks         (R)  status/priority/search/assignedToMe + limit
 *   - feedock_get_task           (R)  detail + git refs + subtasks + activity + roadmap link
 *   - feedock_create_task        (+)  title/description/priority/assignee?/milestone?/roadmapItem?
 *   - feedock_update_task        (~)  edit fields; null clears a nullable field; status stays with the status tool
 *   - feedock_update_task_status (~)  re-Done rewrites completedAt (not idempotent today)
 *   - feedock_delete_task        (!)  confirm:true; irreversible; subtasks re-parent to top level
 *
 * Contract (the same one every tool module follows):
 *   - raw zod input/output **shapes** (the SDK wraps them — never `z.object` here);
 *   - **all four** annotations set explicitly on every tool (the legend marks only
 *     non-defaults — §5.3);
 *   - the mapper projects API rows → the public-safe shape, **sanitizes rich-text
 *     in the mapper** (`lib/sanitize`) before building `structuredContent` + the
 *     JSON text block (the SDK discards transformed output, so a schema
 *     `.transform` would ship raw HTML — §5.3);
 *   - lists return `{ items, atCap }` via `paginate` (the dashboard list takes only
 *     a `filter`, caps at 200 server-side, so `atCap` is a lower-bound flag);
 *   - failures funnel through `toApiToolError` — we never throw across the boundary.
 *
 * Tenancy: the PAT binds the project; the client sends no project id and the model
 * supplies none. Owner/Admin-only affordances surface the API's authz error (none
 * of these tasks tools are role-gated — `tasks`/`task`/`createTask`/`updateTaskStatus`
 * are `GqlAuthGuard + TenantGuard`, any active member).
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import {
  CREATE_TASK_MUTATION,
  DELETE_TASK_MUTATION,
  TASK_ACTIVITY_QUERY,
  TASK_QUERY,
  TASKS_QUERY,
  UPDATE_TASK_MUTATION,
  UPDATE_TASK_STATUS_MUTATION,
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
  GitRefItem,
  ListInputShape,
  listOutputShape,
  TaskActivityItem,
  TaskItem,
  TaskPriorityEnum,
  TaskStatusEnum,
  uuid,
  type TaskPriority,
  type TaskStatus,
} from "../schemas/index.js";
import type { ToolContext } from "./context.js";

// --- Raw API row shapes (what operations.ts selects) ------------------------

interface ApiTask {
  id: string;
  number: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  milestoneId: string | null;
  roadmapItemId: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface ApiGitRef {
  id: string;
  provider: string;
  refType: string;
  externalId: string;
  url: string | null;
  title: string | null;
  state: string | null;
  authorLogin: string | null;
}

interface ApiSubtask {
  id: string;
  number: number;
  title: string;
  status: TaskStatus;
}

interface ApiTaskActivity {
  id: string;
  type: string;
  field: string | null;
  fromValue: string | null;
  toValue: string | null;
  actorName: string | null;
  createdAt: string;
}

interface TasksData {
  tasks: ApiTask[];
}
interface TaskData {
  task: (ApiTask & { gitRefs: ApiGitRef[]; subtasks: ApiSubtask[] }) | null;
}
interface TaskActivityData {
  taskActivity: ApiTaskActivity[];
}
interface CreateTaskData {
  createTask: ApiTask;
}
interface UpdateTaskStatusData {
  updateTaskStatus: ApiTask;
}
interface UpdateTaskData {
  updateTask: ApiTask;
}
interface DeleteTaskData {
  deleteTask: boolean;
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

// --- Mappers (sanitize rich-text HERE, before structuredContent) ------------

/** Project an API task → the public-safe item shape, sanitizing `description`. */
function mapTask(t: ApiTask): z.infer<typeof TaskItem> {
  return {
    id: t.id,
    number: t.number,
    title: t.title,
    description:
      t.description === null ? null : sanitizeRichText(t.description),
    status: t.status,
    priority: t.priority,
    assigneeId: t.assigneeId,
    milestoneId: t.milestoneId,
    roadmapItemId: t.roadmapItemId,
    dueDate: t.dueDate,
    completedAt: t.completedAt,
    createdAt: t.createdAt,
  };
}

function mapGitRef(r: ApiGitRef): z.infer<typeof GitRefItem> {
  return {
    id: r.id,
    provider: r.provider,
    refType: r.refType,
    externalId: r.externalId,
    url: r.url,
    title: r.title,
    state: r.state,
    authorLogin: r.authorLogin,
  };
}

function mapActivity(a: ApiTaskActivity): z.infer<typeof TaskActivityItem> {
  return {
    id: a.id,
    type: a.type,
    field: a.field,
    fromValue: a.fromValue,
    toValue: a.toValue,
    actorName: a.actorName,
    createdAt: a.createdAt,
  };
}

// --- I/O schemas ------------------------------------------------------------

const SubtaskItem = z.object({
  id: uuid,
  number: z.number().int().describe('surfaced as "T-<number>"'),
  title: z.string(),
  status: TaskStatusEnum,
});

const ListTasksInput = {
  status: TaskStatusEnum.optional().describe("filter to one task status"),
  priority: TaskPriorityEnum.optional().describe("filter to one priority"),
  assignedToMe: z
    .boolean()
    .optional()
    .describe("only tasks assigned to the PAT's own member"),
  ...ListInputShape,
} as const;

const ListTasksOutput = listOutputShape(TaskItem);

const GetTaskInput = {
  id: uuid.describe("the task id"),
} as const;

const GetTaskOutput = {
  task: TaskItem.extend({
    gitRefs: z
      .array(GitRefItem)
      .describe("linked PRs/commits/branches (T-<number> refs)"),
    subtasks: z.array(SubtaskItem),
    activity: z
      .array(TaskActivityItem)
      .describe("append-only change log, newest first"),
  }),
} as const;

const CreateTaskInputShape = {
  title: z.string().min(1).max(200).describe("the task title"),
  description: z
    .string()
    .optional()
    .describe(
      "the body, in MARKDOWN — headings, **bold**, `code`, ```fenced blocks```, lists, > quotes, [links](url). Converted to the dashboard's rich text, so write it for a person to read, not as one plain paragraph.",
    ),
  priority: TaskPriorityEnum.optional().describe(
    "Urgent·High·Medium·Low·None (defaults to None)",
  ),
  assigneeId: uuid.optional().describe("the member to assign (single)"),
  assigneeIds: z
    .array(uuid)
    .optional()
    .describe("assign multiple members; the first is the primary"),
  milestoneId: uuid.optional().describe("group under this milestone"),
  roadmapItemId: uuid.optional().describe("down-link from a roadmap item"),
  labelIds: z
    .array(uuid)
    .optional()
    .describe("attach these project labels (label ids)"),
  startDate: z
    .string()
    .optional()
    .describe("ISO 8601 planned start (must be on/before dueDate)"),
} as const;

const TaskOutput = { task: TaskItem } as const;

const UpdateTaskStatusInputShape = {
  id: uuid.describe("the task id"),
  status: TaskStatusEnum.describe(
    "Backlog·Planned·InProgress·Review·Done (re-running Done rewrites completedAt to now)",
  ),
} as const;

const UpdateTaskInputShape = {
  id: uuid.describe("the task id"),
  title: z.string().min(1).max(200).optional().describe("new title"),
  description: z
    .string()
    .nullable()
    .optional()
    .describe(
      "the body, in MARKDOWN (replaces the whole body — read it first with feedock_get_task); null clears it",
    ),
  priority: TaskPriorityEnum.optional().describe("Urgent·High·Medium·Low·None"),
  assigneeId: uuid
    .nullable()
    .optional()
    .describe("the single member to assign; null unassigns"),
  assigneeIds: z
    .array(uuid)
    .optional()
    .describe(
      "replace the whole assignee set (first = primary); [] clears all assignees",
    ),
  milestoneId: uuid
    .nullable()
    .optional()
    .describe("group under this milestone; null detaches"),
  roadmapItemId: uuid
    .nullable()
    .optional()
    .describe("down-link from a roadmap item; null unlinks"),
  labelIds: z
    .array(uuid)
    .optional()
    .describe("replace the task's labels (label ids); [] clears all labels"),
  startDate: z
    .string()
    .nullable()
    .optional()
    .describe("ISO 8601 planned start (<= dueDate); null clears it"),
  dueDate: z
    .string()
    .nullable()
    .optional()
    .describe("ISO 8601 due date (e.g. 2026-08-01T00:00:00Z); null clears it"),
} as const;

const DeleteTaskInputShape = {
  id: uuid.describe("the task id"),
  // Deletion is irreversible and reachable from untrusted task text via prompt
  // injection — mirror merge_feedback's explicit-confirmation friction (§5.1).
  confirm: z
    .literal(true)
    .describe("explicit confirmation; deletion is permanent — must be true"),
} as const;

const DeleteTaskOutput = {
  deleted: z.literal(true),
  id: uuid.describe("the deleted task id"),
} as const;

// --- Registration -----------------------------------------------------------

export function registerTaskTools(server: McpServer, ctx: ToolContext): void {
  const { client } = ctx;

  server.registerTool(
    "feedock_list_tasks",
    {
      title: "List tasks",
      description:
        "List the project's internal tasks. Filter by status, priority, free-text search, or `assignedToMe` (the PAT's own member). Read-only. Returns up to 200 (the API cap) — `atCap=true` means more may exist. Use `feedock_get_task` for one task's detail.",
      inputSchema: ListTasksInput,
      outputSchema: ListTasksOutput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        const filter = {
          ...(args.status ? { status: args.status } : {}),
          ...(args.priority ? { priority: args.priority } : {}),
          ...(args.search ? { search: args.search } : {}),
          ...(args.assignedToMe ? { assignedToMe: args.assignedToMe } : {}),
        };
        const data = await client.request<TasksData>(TASKS_QUERY, { filter });
        const { items, atCap } = paginate(
          (data.tasks ?? []).map(mapTask),
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
    "feedock_get_task",
    {
      title: "Get a task",
      description:
        "Fetch one task's full detail: its fields plus linked git refs (PRs/commits/branches), subtasks, the append-only activity log, and its roadmap link (`roadmapItemId`). Rich-text is sanitized. Read-only.",
      inputSchema: GetTaskInput,
      outputSchema: GetTaskOutput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        const [detail, activityData] = await Promise.all([
          client.request<TaskData>(TASK_QUERY, { id: args.id }),
          client.request<TaskActivityData>(TASK_ACTIVITY_QUERY, {
            taskId: args.id,
          }),
        ]);
        const t = detail.task;
        if (!t) {
          return toolError("Task not found — check the id.");
        }
        const out = {
          task: {
            ...mapTask(t),
            gitRefs: (t.gitRefs ?? []).map(mapGitRef),
            subtasks: (t.subtasks ?? []).map((s) => ({
              id: s.id,
              number: s.number,
              title: s.title,
              status: s.status,
            })),
            activity: (activityData.taskActivity ?? []).map(mapActivity),
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
    "feedock_create_task",
    {
      title: "Create a task",
      description:
        "Create an internal task (defaults to Backlog). Optionally set priority, one or many assignees, labels, a start date, milestone, or a roadmap-item down-link. Additive. Returns the created task.",
      inputSchema: CreateTaskInputShape,
      outputSchema: TaskOutput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        const input = {
          title: args.title,
          ...(args.description !== undefined
            ? { description: toRichTextHtml(args.description) }
            : {}),
          ...(args.priority ? { priority: args.priority } : {}),
          ...(args.assigneeId ? { assigneeId: args.assigneeId } : {}),
          ...(args.assigneeIds !== undefined
            ? { assigneeIds: args.assigneeIds }
            : {}),
          ...(args.milestoneId ? { milestoneId: args.milestoneId } : {}),
          ...(args.roadmapItemId ? { roadmapItemId: args.roadmapItemId } : {}),
          ...(args.labelIds !== undefined ? { labelIds: args.labelIds } : {}),
          ...(args.startDate !== undefined
            ? { startDate: args.startDate }
            : {}),
        };
        const data = await client.request<CreateTaskData>(
          CREATE_TASK_MUTATION,
          {
            input,
          },
        );
        const out = { task: mapTask(data.createTask) };
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
    "feedock_update_task",
    {
      title: "Update a task",
      description:
        "Edit a task's fields: title, description (replaces the whole body — read it first with `feedock_get_task`), priority, assignees (single `assigneeId` or the whole `assigneeIds` set), labels, start date, milestone, roadmap link, or due date. Pass null to CLEAR a nullable field (an empty array clears assignees/labels); omitted fields stay untouched. Status moves stay with `feedock_update_task_status`. Returns the updated task.",
      inputSchema: UpdateTaskInputShape,
      outputSchema: TaskOutput,
      annotations: {
        // Same-args re-run writes the same values (status — the one field whose
        // re-run has side effects — is deliberately not accepted here).
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        const input = {
          id: args.id,
          ...(args.title !== undefined ? { title: args.title } : {}),
          ...(args.description !== undefined
            ? {
                description:
                  args.description === null
                    ? null
                    : toRichTextHtml(args.description),
              }
            : {}),
          ...(args.priority !== undefined ? { priority: args.priority } : {}),
          ...(args.assigneeId !== undefined
            ? { assigneeId: args.assigneeId }
            : {}),
          ...(args.assigneeIds !== undefined
            ? { assigneeIds: args.assigneeIds }
            : {}),
          ...(args.milestoneId !== undefined
            ? { milestoneId: args.milestoneId }
            : {}),
          ...(args.roadmapItemId !== undefined
            ? { roadmapItemId: args.roadmapItemId }
            : {}),
          ...(args.labelIds !== undefined ? { labelIds: args.labelIds } : {}),
          ...(args.startDate !== undefined
            ? { startDate: args.startDate }
            : {}),
          ...(args.dueDate !== undefined ? { dueDate: args.dueDate } : {}),
        };
        const data = await client.request<UpdateTaskData>(
          UPDATE_TASK_MUTATION,
          {
            input,
          },
        );
        const out = { task: mapTask(data.updateTask) };
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
    "feedock_delete_task",
    {
      title: "Delete a task",
      description:
        "Permanently delete a task. Its subtasks are NOT deleted — they re-parent to top level. Irreversible; requires `confirm: true`. Prefer moving a task to Backlog or Done over deleting unless the human explicitly asked for deletion.",
      inputSchema: DeleteTaskInputShape,
      outputSchema: DeleteTaskOutput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        await client.request<DeleteTaskData>(DELETE_TASK_MUTATION, {
          id: args.id,
        });
        const out = { deleted: true as const, id: args.id };
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
    "feedock_update_task_status",
    {
      title: "Update task status",
      description:
        "Move a task to Backlog·Planned·InProgress·Review·Done. NOT idempotent today: re-running with Done rewrites `completedAt` to now each call, so only call it when the status should actually change. Returns the updated task.",
      inputSchema: UpdateTaskStatusInputShape,
      outputSchema: TaskOutput,
      annotations: {
        // `~` in the legend: re-running re-fires effects (Done rewrites
        // completedAt), so it is NOT idempotent until the service no-ops when
        // already at the target (§5.2). Not destructive (a recoverable move).
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        const data = await client.request<UpdateTaskStatusData>(
          UPDATE_TASK_STATUS_MUTATION,
          { input: { id: args.id, status: args.status } },
        );
        const out = { task: mapTask(data.updateTaskStatus) };
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
