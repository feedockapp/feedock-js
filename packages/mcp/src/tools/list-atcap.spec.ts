/**
 * `atCap` at the tool boundary (docs/features/mcp-server.md §5.3 + §5.2). A list
 * tool must set `atCap = rows.length === MAX_LIST_ROWS` over the API's full
 * returned page — true only when the API returned exactly its 200-row cap (more
 * MAY exist), false otherwise. The tool's `limit` is display-only slicing and
 * must not affect the flag.
 */

import { describe, expect, it } from "vitest";

import { MAX_LIST_ROWS } from "../lib/pagination.js";
import { createCaptureServer, createMockClient } from "../test-support.js";
import { registerChangelogTools } from "./changelog.js";
import { registerFeedbackTools } from "./feedback.js";
import { registerRoadmapTools } from "./roadmap.js";
import { registerTaskTools } from "./tasks.js";

function feedbackRow(i: number) {
  return {
    id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
    title: `item ${i}`,
    body: null,
    status: "Open",
    kind: "Request",
    voteCount: 0,
    requesterCount: 0,
    visibility: "PUBLIC",
    roadmapItemId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function taskRow(i: number) {
  return {
    id: `10000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
    number: i,
    title: `task ${i}`,
    description: null,
    status: "Backlog",
    priority: "None",
    assigneeId: null,
    milestoneId: null,
    roadmapItemId: null,
    dueDate: null,
    completedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("list tool atCap", () => {
  it("list_feedback sets atCap=true when the API returns exactly MAX_LIST_ROWS", async () => {
    const cap = createCaptureServer();
    const rows = Array.from({ length: MAX_LIST_ROWS }, (_, i) =>
      feedbackRow(i),
    );
    const client = createMockClient([{ feedbackList: rows }]);
    registerFeedbackTools(cap.server, { client });

    const result = await cap.get("feedock_list_feedback").run({ sort: "top" });
    const out = result.structuredContent as {
      items: unknown[];
      atCap: boolean;
    };
    expect(out.atCap).toBe(true);
  });

  it("list_feedback sets atCap=false for a short page", async () => {
    const cap = createCaptureServer();
    const rows = Array.from({ length: 3 }, (_, i) => feedbackRow(i));
    const client = createMockClient([{ feedbackList: rows }]);
    registerFeedbackTools(cap.server, { client });

    const result = await cap.get("feedock_list_feedback").run({ sort: "top" });
    const out = result.structuredContent as { atCap: boolean };
    expect(out.atCap).toBe(false);
  });

  it("the client `limit` only narrows the returned items — it never flips atCap", async () => {
    const cap = createCaptureServer();
    const rows = Array.from({ length: MAX_LIST_ROWS }, (_, i) =>
      feedbackRow(i),
    );
    const client = createMockClient([{ feedbackList: rows }]);
    registerFeedbackTools(cap.server, { client });

    const result = await cap
      .get("feedock_list_feedback")
      .run({ sort: "top", limit: 5 });
    const out = result.structuredContent as {
      items: unknown[];
      atCap: boolean;
    };
    expect(out.items).toHaveLength(5);
    expect(out.atCap).toBe(true); // still flagged — the API hit its cap
  });

  it("list_tasks sets atCap=true at the cap too (same envelope)", async () => {
    const cap = createCaptureServer();
    const rows = Array.from({ length: MAX_LIST_ROWS }, (_, i) => taskRow(i));
    const client = createMockClient([{ tasks: rows }]);
    registerTaskTools(cap.server, { client });

    const result = await cap.get("feedock_list_tasks").run({});
    const out = result.structuredContent as { atCap: boolean };
    expect(out.atCap).toBe(true);
  });
});

// ── Client-side filters (roadmap column · changelog state/search) ───────────
// These tools filter the API's already-capped page IN the tool. `atCap` must
// reflect the UNFILTERED page length (the API caps BEFORE the filter), so a
// filter that drops rows below the cap must NOT flip atCap to false (§5).

function roadmapRow(i: number, column: string) {
  return {
    id: `20000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
    title: `roadmap ${i}`,
    description: null,
    column,
    visibility: "PUBLIC",
    targetWindow: null,
    milestoneId: null,
    peopleAsked: 0,
    feedbackCount: 0,
    taskCount: 0,
    shippedAt: null,
  };
}

function changelogRow(i: number, state: string, title: string) {
  return {
    id: `30000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
    title,
    body: "<p>body</p>",
    whyItMatters: null,
    category: "New",
    state,
    visibility: "PUBLIC",
    slug: `entry-${i}`,
    publishedAt: null,
    requesterCount: 0,
  };
}

describe("list tool atCap — client-side filters", () => {
  it("list_roadmap keeps atCap=true when a column filter narrows a full page", async () => {
    const cap = createCaptureServer();
    // A full API page (200), but only 3 are in the "Next" lane.
    const rows = Array.from({ length: MAX_LIST_ROWS }, (_, i) =>
      roadmapRow(i, i < 3 ? "Next" : "Now"),
    );
    const client = createMockClient([{ roadmapItems: rows }]);
    registerRoadmapTools(cap.server, { client });

    const result = await cap
      .get("feedock_list_roadmap")
      .run({ column: "Next" });
    const out = result.structuredContent as {
      items: unknown[];
      atCap: boolean;
    };
    expect(out.items).toHaveLength(3); // filtered view
    expect(out.atCap).toBe(true); // ...but the API still hit its cap
  });

  it("list_changelog keeps atCap=true when a state filter narrows a full page", async () => {
    const cap = createCaptureServer();
    const rows = Array.from({ length: MAX_LIST_ROWS }, (_, i) =>
      changelogRow(i, i < 2 ? "Draft" : "Published", `entry ${i}`),
    );
    const client = createMockClient([{ changelogEntries: rows }]);
    registerChangelogTools(cap.server, { client });

    const result = await cap
      .get("feedock_list_changelog")
      .run({ state: "Draft" });
    const out = result.structuredContent as {
      items: unknown[];
      atCap: boolean;
    };
    expect(out.items).toHaveLength(2);
    expect(out.atCap).toBe(true);
  });

  it("list_changelog applies the client-side search filter (title/why/body)", async () => {
    const cap = createCaptureServer();
    const rows = [
      changelogRow(0, "Published", "Dark mode shipped"),
      changelogRow(1, "Published", "Faster search"),
      changelogRow(2, "Published", "Bug fixes"),
    ];
    const client = createMockClient([{ changelogEntries: rows }]);
    registerChangelogTools(cap.server, { client });

    const result = await cap
      .get("feedock_list_changelog")
      .run({ search: "dark" });
    const out = result.structuredContent as {
      items: { title: string }[];
      atCap: boolean;
    };
    expect(out.items).toHaveLength(1);
    expect(out.items[0]?.title).toBe("Dark mode shipped");
    expect(out.atCap).toBe(false); // short page, no cap
  });
});
