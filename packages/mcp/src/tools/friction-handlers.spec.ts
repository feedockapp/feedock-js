/**
 * Server-side friction at the HANDLER level (docs/features/mcp-server.md §5.1).
 * The schema test (`schemas/friction.spec.ts`) proves the inputs reject bad
 * shapes; this proves the handlers enforce the friction the schema can't:
 *
 *  - merge_feedback re-fetches the canonical and REJECTS (isError, no fold) when
 *    its current title differs from `expectedCanonicalTitle` — the race guard —
 *    and never calls the merge mutation in that case.
 *  - publish_changelog re-checks the live preview and REJECTS when the entry's
 *    firstPublish state no longer matches `expectedFirstPublish`, before any
 *    state-change mutation runs.
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createCaptureServer, createMockClient } from "../test-support.js";
import { registerChangelogTools } from "./changelog.js";
import { registerFeedbackTools } from "./feedback.js";
import { registerRoadmapTools } from "./roadmap.js";

const CANON_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const DUP_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const ENTRY_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const FEEDBACK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"; // valid v4 (schema-parsed)
const VALID_TOKEN = `1717171717171.${"a".repeat(64)}`;

function roadmapRow(visibility: "PUBLIC" | "PRIVATE") {
  return {
    id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
    title: "New idea",
    description: null,
    column: "Later",
    visibility,
    targetWindow: null,
    milestoneId: null,
    peopleAsked: 0,
    feedbackCount: 0,
    taskCount: 0,
    shippedAt: null,
  };
}

function feedbackRow(title: string) {
  return {
    id: CANON_ID,
    title,
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

describe("merge_feedback race guard", () => {
  it("rejects (isError) and does NOT merge when the canonical title drifted", async () => {
    const cap = createCaptureServer();
    // First request: feedbackItem(canonical) → returns the CURRENT (drifted) title.
    const client = createMockClient([
      { feedbackItem: feedbackRow("Actually a different title") },
    ]);
    registerFeedbackTools(cap.server, { client });

    const result = await cap.get("feedock_merge_feedback").run({
      duplicateId: DUP_ID,
      canonicalId: CANON_ID,
      confirm: true,
      expectedCanonicalTitle: "Dark mode",
    });

    expect(result.isError).toBe(true);
    expect("structuredContent" in result).toBe(false);
    const text = (result.content[0] as { text: string }).text;
    expect(text).toMatch(/title mismatch/i);
    // Only the read happened — the merge mutation was NEVER called.
    expect(client.calls).toHaveLength(1);
  });

  it("proceeds to merge when the title matches the expected one", async () => {
    const cap = createCaptureServer();
    const client = createMockClient([
      { feedbackItem: feedbackRow("Dark mode") }, // race-guard read
      { mergeFeedback: feedbackRow("Dark mode") }, // the fold
    ]);
    registerFeedbackTools(cap.server, { client });

    const result = await cap.get("feedock_merge_feedback").run({
      duplicateId: DUP_ID,
      canonicalId: CANON_ID,
      confirm: true,
      expectedCanonicalTitle: "Dark mode",
    });

    expect(result.isError).toBeFalsy();
    expect(client.calls).toHaveLength(2); // read + merge
    const out = result.structuredContent as { canonical: { title: string } };
    expect(out.canonical.title).toBe("Dark mode");
  });
});

describe("publish_changelog firstPublish guard", () => {
  it("rejects when expectedFirstPublish no longer matches the live preview", async () => {
    const cap = createCaptureServer();
    // The live preview says firstPublish=false (already published), but the
    // caller passed expectedFirstPublish=true → reject before any mutation.
    const client = createMockClient([
      {
        changelogPublishPreview: {
          requesterCount: 0,
          subscriberCount: 0,
          roadmapItemCount: 1,
          firstPublish: false,
          previewToken: VALID_TOKEN,
        },
      },
    ]);
    registerChangelogTools(cap.server, { client });

    const result = await cap.get("feedock_publish_changelog").run({
      id: ENTRY_ID,
      confirm: true,
      previewToken: VALID_TOKEN,
      expectedFirstPublish: true,
    });

    expect(result.isError).toBe(true);
    expect("structuredContent" in result).toBe(false);
    const text = (result.content[0] as { text: string }).text;
    expect(text).toMatch(/expectedFirstPublish/);
    // Only the preview re-check ran — the state mutation was NEVER called.
    expect(client.calls).toHaveLength(1);
  });
});

describe("create_roadmap_item PUBLIC-write confirmation (M-27)", () => {
  it("REJECTS a PUBLIC item without confirm:true and never calls the mutation", async () => {
    const cap = createCaptureServer();
    const client = createMockClient([]);
    registerRoadmapTools(cap.server, { client });

    const result = await cap.get("feedock_create_roadmap_item").run({
      title: "Public plan",
      visibility: "PUBLIC",
    });

    expect(result.isError).toBe(true);
    expect(client.calls).toHaveLength(0); // no create mutation
    const text = (result.content[0] as { text: string }).text;
    expect(text).toMatch(/confirm:true/);
  });

  it("proceeds for a PUBLIC item WITH confirm:true (and strips confirm from the mutation input)", async () => {
    const cap = createCaptureServer();
    const client = createMockClient([
      { createRoadmapItem: roadmapRow("PUBLIC") },
    ]);
    registerRoadmapTools(cap.server, { client });

    const result = await cap.get("feedock_create_roadmap_item").run({
      title: "Public plan",
      visibility: "PUBLIC",
      confirm: true,
    });

    expect(result.isError).toBeFalsy();
    expect(client.calls).toHaveLength(1);
    // confirm is a client-side guard, not part of the GraphQL input.
    const sentInput = (client.calls[0]!.variables as { input: object }).input;
    expect(sentInput).not.toHaveProperty("confirm");
  });

  it("does NOT require confirm for a PRIVATE (internal) item", async () => {
    const cap = createCaptureServer();
    const client = createMockClient([
      { createRoadmapItem: roadmapRow("PRIVATE") },
    ]);
    registerRoadmapTools(cap.server, { client });

    const result = await cap.get("feedock_create_roadmap_item").run({
      title: "Internal plan",
      visibility: "PRIVATE",
    });

    expect(result.isError).toBeFalsy();
    expect(client.calls).toHaveLength(1);
  });
});

describe("convert_feedback_to_roadmap PUBLIC-default confirmation (M-27 follow-up)", () => {
  it("REJECTS a convert without confirm (defaults PUBLIC) and never calls the mutation", async () => {
    const cap = createCaptureServer();
    const client = createMockClient([]);
    registerFeedbackTools(cap.server, { client });
    const result = await cap.get("feedock_convert_feedback_to_roadmap").run({
      id: FEEDBACK_ID,
    });
    expect(result.isError).toBe(true);
    expect(client.calls).toHaveLength(0);
    const text = (result.content[0] as { text: string }).text;
    expect(text).toMatch(/confirm:true|visibility:PRIVATE/);
  });

  it("proceeds with confirm:true", async () => {
    const cap = createCaptureServer();
    const client = createMockClient([
      { convertFeedbackToRoadmap: roadmapRow("PUBLIC") },
    ]);
    registerFeedbackTools(cap.server, { client });
    const result = await cap.get("feedock_convert_feedback_to_roadmap").run({
      id: FEEDBACK_ID,
      confirm: true,
    });
    expect(result.isError).toBeFalsy();
    expect(client.calls).toHaveLength(1);
  });

  it("does NOT require confirm when visibility is explicitly PRIVATE", async () => {
    const cap = createCaptureServer();
    const client = createMockClient([
      { convertFeedbackToRoadmap: roadmapRow("PRIVATE") },
    ]);
    registerFeedbackTools(cap.server, { client });
    const result = await cap.get("feedock_convert_feedback_to_roadmap").run({
      id: FEEDBACK_ID,
      visibility: "PRIVATE",
    });
    expect(result.isError).toBeFalsy();
    expect(client.calls).toHaveLength(1);
  });
});

describe("move_roadmap_item to Shipped confirmation (M-27 follow-up)", () => {
  it("REJECTS a move to Shipped without confirm and never calls the mutation", async () => {
    const cap = createCaptureServer();
    const client = createMockClient([]);
    registerRoadmapTools(cap.server, { client });
    const result = await cap.get("feedock_move_roadmap_item").run({
      id: FEEDBACK_ID,
      column: "Shipped",
    });
    expect(result.isError).toBe(true);
    expect(client.calls).toHaveLength(0);
    expect((result.content[0] as { text: string }).text).toMatch(/confirm:true/);
  });

  it("proceeds to Shipped WITH confirm (and strips confirm from the mutation input)", async () => {
    const cap = createCaptureServer();
    const client = createMockClient([
      { moveRoadmapItem: roadmapRow("PUBLIC") },
    ]);
    registerRoadmapTools(cap.server, { client });
    const result = await cap.get("feedock_move_roadmap_item").run({
      id: FEEDBACK_ID,
      column: "Shipped",
      confirm: true,
    });
    expect(result.isError).toBeFalsy();
    expect(client.calls).toHaveLength(1);
    const sentInput = (client.calls[0]!.variables as { input: object }).input;
    expect(sentInput).not.toHaveProperty("confirm");
  });

  it("does NOT require confirm for a non-Shipped lane", async () => {
    const cap = createCaptureServer();
    const client = createMockClient([{ moveRoadmapItem: roadmapRow("PUBLIC") }]);
    registerRoadmapTools(cap.server, { client });
    const result = await cap.get("feedock_move_roadmap_item").run({
      id: FEEDBACK_ID,
      column: "Now",
    });
    expect(result.isError).toBeFalsy();
    expect(client.calls).toHaveLength(1);
  });
});

describe("add_feedback_comment requires confirm:true (M-27, schema-enforced)", () => {
  it("rejects a comment payload missing confirm, and accepts confirm:true", () => {
    const cap = createCaptureServer();
    registerFeedbackTools(cap.server, { client: createMockClient([]) });
    const shape = cap.get("feedock_add_feedback_comment")
      .inputSchema as z.ZodRawShape;
    const schema = z.object(shape);

    expect(schema.safeParse({ id: FEEDBACK_ID, body: "hi" }).success).toBe(
      false,
    );
    expect(
      schema.safeParse({ id: FEEDBACK_ID, body: "hi", confirm: false }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ id: FEEDBACK_ID, body: "hi", confirm: true }).success,
    ).toBe(true);
  });
});
