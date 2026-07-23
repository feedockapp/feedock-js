/**
 * Shared zod input/output shapes for the tool catalog
 * (docs/features/mcp-server.md §5.3). Reused by Phase 2's remote server.
 *
 * **SDK calling convention (v1.x):** `registerTool` takes `inputSchema` /
 * `outputSchema` as a **raw Zod shape object** (`{ field: z.string() }`), **not**
 * `z.object({…})` — the SDK wraps it. So every reusable shape here is a plain
 * object literal (spread into a tool's schema), and the matching `z.object(...)`
 * is exported only where a nested object value is needed.
 *
 * Enum tuples mirror the API's Prisma/GraphQL enums exactly; the union types are
 * **derived** from the tuples (no drift). Keep these in lockstep with
 * `packages/db/prisma/schema.prisma`.
 */

import { z } from "zod";

// --- Domain enums (tuples → zod enum → derived union) ----------------------

export const FEEDBACK_STATUS = [
  "Open",
  "UnderReview",
  "Planned",
  "InProgress",
  "Shipped",
  "Declined",
] as const;
export const StatusEnum = z.enum(FEEDBACK_STATUS);
export type FeedbackStatus = (typeof FEEDBACK_STATUS)[number];

export const FEEDBACK_KIND = ["Request", "Bug", "Idea"] as const;
export const KindEnum = z.enum(FEEDBACK_KIND);
export type FeedbackKind = (typeof FEEDBACK_KIND)[number];

export const VISIBILITY = ["PUBLIC", "PRIVATE"] as const;
export const VisibilityEnum = z.enum(VISIBILITY);
export type Visibility = (typeof VISIBILITY)[number];

/** Board ordering (GraphQL-only `FeedbackSort`, mapped from the tool's lowercase). */
export const FEEDBACK_SORT = ["top", "new"] as const;
export const FeedbackSortEnum = z.enum(FEEDBACK_SORT);
export type FeedbackSort = (typeof FEEDBACK_SORT)[number];

export const ROADMAP_COLUMN = ["Now", "Next", "Later", "Shipped"] as const;
export const RoadmapColumnEnum = z.enum(ROADMAP_COLUMN);
export type RoadmapColumn = (typeof ROADMAP_COLUMN)[number];

export const TASK_STATUS = [
  "Backlog",
  "Planned",
  "InProgress",
  "Review",
  "Done",
] as const;
export const TaskStatusEnum = z.enum(TASK_STATUS);
export type TaskStatus = (typeof TASK_STATUS)[number];

export const TASK_PRIORITY = [
  "Urgent",
  "High",
  "Medium",
  "Low",
  "None",
] as const;
export const TaskPriorityEnum = z.enum(TASK_PRIORITY);
export type TaskPriority = (typeof TASK_PRIORITY)[number];

export const MILESTONE_STATUS = ["Planned", "Active", "Shipped"] as const;
export const MilestoneStatusEnum = z.enum(MILESTONE_STATUS);
export type MilestoneStatus = (typeof MILESTONE_STATUS)[number];

/**
 * How precise a soft target date is. The stored date holds the period START, so
 * `2026-07-01` + `Quarter` reads as "Q3 2026". `null` = a concrete day.
 */
export const DATE_PRECISION = [
  "Day",
  "Month",
  "Quarter",
  "HalfYear",
  "Year",
] as const;
export const DatePrecisionEnum = z.enum(DATE_PRECISION);
export type DatePrecision = (typeof DATE_PRECISION)[number];

export const CHANGELOG_STATE = ["Draft", "Review", "Published"] as const;
export const ChangelogStateEnum = z.enum(CHANGELOG_STATE);
export type ChangelogState = (typeof CHANGELOG_STATE)[number];

export const CHANGELOG_CATEGORY = ["New", "Improved", "Fixed"] as const;
export const ChangelogCategoryEnum = z.enum(CHANGELOG_CATEGORY);
export type ChangelogCategory = (typeof CHANGELOG_CATEGORY)[number];

export const DOC_TYPE = [
  "Prd",
  "TechNote",
  "LaunchChecklist",
  "DecisionLog",
  "CustomerResearch",
  "MeetingNotes",
  "Freeform",
] as const;
export const DocTypeEnum = z.enum(DOC_TYPE);
export type DocType = (typeof DOC_TYPE)[number];

// --- Shared field constraints ----------------------------------------------

/** UUID id field (mirrors the API's `@IsUUID()` on every id arg). */
export const uuid = z.string().uuid();

/** Free-text search bound (matches `SEARCH_MAX` / `TASK_SEARCH_MAX` ≈ 200). */
export const searchField = z.string().max(200);

/**
 * Shared list-input shape (raw zod shape — spread into a tool's `inputSchema`).
 * Every list tool exposes the same pagination/filter envelope; tools add their
 * own `status`/`priority`/etc. fields alongside this.
 */
export const ListInputShape = {
  search: searchField
    .optional()
    .describe("free-text filter over the title/body"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .default(50)
    .describe("max items to return; the API hard-caps at 200 regardless"),
} as const;

/**
 * Shared list-output envelope **factory**: lists return `{ items, atCap }`.
 * `atCap` is a lower-bound `mayBeTruncated` flag (true when the API returned its
 * 200-row cap), not proof of clipping (§5.3).
 *
 * Returns a **raw zod shape** for `outputSchema`; pass `item` as a `z.object`.
 */
export function listOutputShape<T extends z.ZodTypeAny>(item: T) {
  return {
    items: z.array(item),
    atCap: z
      .boolean()
      .describe(
        "true if the API returned exactly its 200-row cap — more may exist (a lower-bound mayBeTruncated signal, not proof of clipping)",
      ),
  } as const;
}

// --- Canonical entity item shapes (public-safe projections) ----------------
// Mirror the public read-model rule: counts not emails, display-name only, no
// embeddings/impact-effort/drafts. Used both for list items and detail outputs.

export const FeedbackItem = z.object({
  id: uuid,
  title: z.string(),
  body: z.string().nullable().describe("sanitized rich-text HTML"),
  status: StatusEnum,
  kind: KindEnum,
  voteCount: z.number().int().min(0),
  requesterCount: z.number().int().min(0),
  visibility: VisibilityEnum,
  roadmapItemId: uuid.nullable(),
  createdAt: z.string().describe("ISO-8601"),
});

export const CommentItem = z.object({
  id: uuid,
  body: z.string().describe("sanitized rich-text HTML"),
  isOfficial: z.boolean(),
  authorName: z.string().nullable(),
  createdAt: z.string().describe("ISO-8601"),
});

export const RoadmapItemShape = z.object({
  id: uuid,
  title: z.string(),
  description: z.string().nullable().describe("sanitized rich-text HTML"),
  column: RoadmapColumnEnum,
  visibility: VisibilityEnum,
  targetWindow: z.string().nullable(),
  milestoneId: uuid.nullable(),
  peopleAsked: z.number().int().min(0),
  feedbackCount: z.number().int().min(0),
  taskCount: z.number().int().min(0),
  shippedAt: z.string().nullable().describe("ISO-8601"),
});

export const TaskItem = z.object({
  id: uuid,
  number: z.number().int().describe('surfaced as "T-<number>"'),
  title: z.string(),
  description: z.string().nullable().describe("sanitized rich-text HTML"),
  status: TaskStatusEnum,
  priority: TaskPriorityEnum,
  assigneeId: uuid.nullable(),
  milestoneId: uuid.nullable(),
  roadmapItemId: uuid.nullable(),
  dueDate: z.string().nullable().describe("ISO-8601"),
  completedAt: z.string().nullable().describe("ISO-8601"),
  createdAt: z.string().describe("ISO-8601"),
});

export const GitRefItem = z.object({
  id: uuid,
  provider: z.string(),
  refType: z.string(),
  externalId: z.string().describe("PR number / commit SHA / branch name"),
  url: z.string().nullable(),
  title: z.string().nullable(),
  state: z.string().nullable(),
  authorLogin: z.string().nullable(),
});

export const TaskActivityItem = z.object({
  id: uuid,
  type: z.string(),
  field: z.string().nullable(),
  fromValue: z.string().nullable(),
  toValue: z.string().nullable(),
  actorName: z.string().nullable(),
  createdAt: z.string().describe("ISO-8601"),
});

export const MilestoneItem = z.object({
  id: uuid,
  title: z.string(),
  description: z.string().nullable().describe("sanitized rich-text HTML"),
  status: MilestoneStatusEnum,
  visibility: VisibilityEnum,
  progressPct: z.number().int().min(0).max(100),
  taskCount: z.number().int().min(0),
  doneTaskCount: z.number().int().min(0),
  ownerId: uuid.nullable(),
  startDate: z.string().nullable().describe("ISO-8601 planned start"),
  softTargetDate: z
    .string()
    .nullable()
    .describe("ISO-8601 aspirational target — never enforced"),
  softTargetPrecision: DatePrecisionEnum.nullable().describe(
    "how precise softTargetDate is (the date holds the period START); null = a concrete day",
  ),
});

export const ChangelogItem = z.object({
  id: uuid,
  title: z.string(),
  body: z.string().describe("sanitized rich-text HTML"),
  whyItMatters: z.string().nullable(),
  category: ChangelogCategoryEnum,
  state: ChangelogStateEnum,
  visibility: VisibilityEnum,
  slug: z.string(),
  publishedAt: z.string().nullable().describe("ISO-8601"),
  requesterCount: z.number().int().min(0),
});

export const DocListItem = z.object({
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
  milestoneId: uuid.nullable(),
  updatedAt: z.string().describe("ISO-8601"),
});

export const DocItem = DocListItem.extend({
  body: z.string().describe("sanitized rich-text HTML"),
});

export const PublishPreview = z.object({
  requesterCount: z.number().int().min(0),
  subscriberCount: z.number().int().min(0),
  roadmapItemCount: z.number().int().min(0),
  firstPublish: z.boolean(),
  previewToken: z
    .string()
    .describe('opaque "<issuedAt>.<mac>"; pass to feedock_publish_changelog'),
});

// --- Friction inputs (§5.1) ------------------------------------------------

/** `"<issuedAt>.<mac>"` shape (§5.3) — handler/API still TTL-checks freshness. */
export const PREVIEW_TOKEN_PATTERN = /^\d+\.[a-f0-9]{64}$/;

/** Publish-changelog input — preview-first + confirm + bound effect-set token. */
export const PublishChangelogInput = {
  id: uuid.describe("the changelog entry to publish"),
  confirm: z
    .literal(true)
    .describe("explicit confirmation; must be true to publish"),
  previewToken: z
    .string()
    .regex(PREVIEW_TOKEN_PATTERN)
    .describe("the previewToken from feedock_preview_changelog_publish"),
  expectedFirstPublish: z
    .boolean()
    .describe("must match the preview's firstPublish flag"),
} as const;

/** Merge-feedback input — confirm + a title race-guard checked against canonical. */
export const MergeFeedbackInput = {
  duplicateId: uuid.describe("the feedback to fold away"),
  canonicalId: uuid.describe("the feedback that absorbs the duplicate"),
  confirm: z.literal(true).describe("explicit confirmation; must be true"),
  expectedCanonicalTitle: z
    .string()
    .max(500)
    .describe("the canonical item's current title (race guard)"),
} as const;

// --- Error output ----------------------------------------------------------

/**
 * Error result shape (for reference + tests). Tools build this via
 * `toToolError` in `lib/errors`; it carries **no** `structuredContent`.
 */
export const ToolErrorShape = z.object({
  isError: z.literal(true),
  content: z.array(z.object({ type: z.literal("text"), text: z.string() })),
});
