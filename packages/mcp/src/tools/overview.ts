/**
 * Overview tool (docs/features/mcp-server.md §5 + §5.2):
 *   - feedock_overview (R)  loop snapshot — open-feedback count, roadmap-by-lane,
 *     tasks-by-status, milestone progress, unpublished changelog drafts.
 *
 * This is a **client-side composition** of the existing list operations (no
 * aggregate API exists). Because every dashboard list is **capped at 200 rows**
 * and takes no count/limit argument, the derived counts are **lower bounds**: each
 * section carries a `mayBeTruncated` flag (true when its source list returned the
 * 200-row cap, so the real number could be higher). A single tool, so the register
 * fn is `registerOverviewTool`.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import {
  CHANGELOG_ENTRIES_QUERY,
  FEEDBACK_LIST_QUERY,
  MILESTONES_QUERY,
  ROADMAP_ITEMS_QUERY,
  TASKS_QUERY,
} from "../client/operations.js";
import { toApiToolError } from "../lib/errors.js";
import { atCap } from "../lib/pagination.js";
import {
  CHANGELOG_STATE,
  FEEDBACK_STATUS,
  MILESTONE_STATUS,
  ROADMAP_COLUMN,
  TASK_STATUS,
} from "../schemas/index.js";
import type { ToolContext } from "./context.js";

// --- Raw row shapes (only the fields the overview reads) -------------------

interface FeedbackRow {
  id: string;
  status: (typeof FEEDBACK_STATUS)[number];
}
interface RoadmapRow {
  id: string;
  column: (typeof ROADMAP_COLUMN)[number];
}
interface TaskRow {
  id: string;
  status: (typeof TASK_STATUS)[number];
}
interface MilestoneRow {
  id: string;
  title: string;
  status: (typeof MILESTONE_STATUS)[number];
  progressPct: number;
  taskCount: number;
  doneTaskCount: number;
}
interface ChangelogRow {
  id: string;
  state: (typeof CHANGELOG_STATE)[number];
}

// --- Output schema ---------------------------------------------------------

/** A count that may understate the truth because its source list hit the cap. */
const lowerBoundCount = z.object({
  count: z.number().int().min(0),
  mayBeTruncated: z
    .boolean()
    .describe(
      "true if the source list returned its 200-row cap — the real count may be higher",
    ),
});

const byLane = z.object(
  Object.fromEntries(ROADMAP_COLUMN.map((c) => [c, z.number().int().min(0)])),
);
const byTaskStatus = z.object(
  Object.fromEntries(TASK_STATUS.map((s) => [s, z.number().int().min(0)])),
);

const MilestoneProgress = z.object({
  id: z.string().uuid(),
  title: z.string(),
  status: z.enum(MILESTONE_STATUS),
  progressPct: z.number().int().min(0).max(100),
  taskCount: z.number().int().min(0),
  doneTaskCount: z.number().int().min(0),
});

const OverviewOutput = {
  project: z
    .object({ id: z.string(), name: z.string(), slug: z.string() })
    .nullable()
    .describe(
      "which project these numbers describe — name it when you report them",
    ),
  openFeedback: lowerBoundCount.describe("feedback items in the Open status"),
  roadmapByLane: byLane.describe("roadmap item counts per lane"),
  roadmapMayBeTruncated: z.boolean(),
  tasksByStatus: byTaskStatus.describe("task counts per status"),
  tasksMayBeTruncated: z.boolean(),
  milestones: z
    .array(MilestoneProgress)
    .describe("milestones with derived progress, highest progress first"),
  milestonesMayBeTruncated: z.boolean(),
  unpublishedDrafts: lowerBoundCount.describe(
    "changelog entries not yet Published (Draft + Review)",
  ),
} as const;

/** The terminal changelog state — entries here are NOT "unpublished drafts". */
const CHANGELOG_STATE_PUBLISHED: (typeof CHANGELOG_STATE)[number] = "Published";

// --- Helpers ---------------------------------------------------------------

function tallyBy<T, K extends string>(
  rows: readonly T[],
  keys: readonly K[],
  keyOf: (row: T) => K,
): Record<K, number> {
  const out = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  for (const row of rows) {
    const k = keyOf(row);
    if (k in out) {
      out[k] += 1;
    }
  }
  return out;
}

// --- Registration ----------------------------------------------------------

export function registerOverviewTool(
  server: McpServer,
  ctx: ToolContext,
): void {
  const { client, session } = ctx;

  server.registerTool(
    "feedock_overview",
    {
      title: "Loop overview",
      description:
        "A snapshot of the whole loop: open-feedback count, roadmap items per " +
        "lane, tasks per status, milestone progress, and unpublished changelog " +
        "drafts. Read-only. Composed client-side from the capped (≤200) list " +
        "APIs, so counts are LOWER BOUNDS — each section sets mayBeTruncated when " +
        "its source list hit the cap. Use as the first call to orient before " +
        "drilling in with the list/detail tools.",
      inputSchema: {},
      outputSchema: OverviewOutput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (): Promise<CallToolResult> => {
      try {
        const [feedback, roadmap, tasks, milestones, changelog] =
          await Promise.all([
            client.request<{ feedbackList: FeedbackRow[] }>(
              FEEDBACK_LIST_QUERY,
              { filter: { status: FEEDBACK_STATUS[0] } },
            ),
            client.request<{ roadmapItems: RoadmapRow[] }>(ROADMAP_ITEMS_QUERY),
            client.request<{ tasks: TaskRow[] }>(TASKS_QUERY, {
              filter: undefined,
            }),
            client.request<{ milestones: MilestoneRow[] }>(MILESTONES_QUERY),
            client.request<{ changelogEntries: ChangelogRow[] }>(
              CHANGELOG_ENTRIES_QUERY,
            ),
          ]);

        const openRows = feedback.feedbackList.filter(
          (f) => f.status === FEEDBACK_STATUS[0],
        );
        const drafts = changelog.changelogEntries.filter(
          (e) => e.state !== CHANGELOG_STATE_PUBLISHED,
        );

        const out: z.infer<z.ZodObject<typeof OverviewOutput>> = {
          // The token binds the project (or the session selected it) — the model
          // never passes one, so say which board this is rather than leaving the
          // agent to guess when several are configured.
          project: session?.projectId
            ? {
                id: session.projectId,
                name: session.projectName ?? "",
                slug: session.projectSlug ?? "",
              }
            : null,
          openFeedback: {
            count: openRows.length,
            mayBeTruncated: atCap(feedback.feedbackList.length),
          },
          roadmapByLane: tallyBy(
            roadmap.roadmapItems,
            ROADMAP_COLUMN,
            (r) => r.column,
          ),
          roadmapMayBeTruncated: atCap(roadmap.roadmapItems.length),
          tasksByStatus: tallyBy(tasks.tasks, TASK_STATUS, (t) => t.status),
          tasksMayBeTruncated: atCap(tasks.tasks.length),
          milestones: milestones.milestones
            .map((m) => ({
              id: m.id,
              title: m.title,
              status: m.status,
              progressPct: m.progressPct,
              taskCount: m.taskCount,
              doneTaskCount: m.doneTaskCount,
            }))
            .sort((a, b) => b.progressPct - a.progressPct),
          milestonesMayBeTruncated: atCap(milestones.milestones.length),
          unpublishedDrafts: {
            count: drafts.length,
            mayBeTruncated: atCap(changelog.changelogEntries.length),
          },
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
}
