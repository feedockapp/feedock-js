/**
 * Sanitize-on-output — THE most important test (docs/features/mcp-server.md §5.3
 * + §6 rule 3). The dashboard GraphQL returns **raw** rich-text HTML; the tool
 * mappers must strip `<script>`, inline event handlers (`onerror=…`), and
 * `javascript:` URLs **before** building `structuredContent` + the JSON text
 * block (the SDK validates `outputSchema` but discards the transformed value, so
 * sanitizing in a schema `.transform` would ship raw HTML — the mapper is the
 * only thing standing between stored markup and the model).
 *
 * Each case mocks the GraphQL client to return a malicious body, runs the real
 * tool handler, and asserts BOTH channels (structuredContent AND the text block)
 * are clean — text and structured must stay in lockstep.
 */

import { describe, expect, it } from "vitest";

import {
  createCaptureServer,
  createMockClient,
  expectNoXss,
  parseResultText,
  XSS_PAYLOAD,
} from "../test-support.js";
import { registerChangelogTools } from "./changelog.js";
import { registerDocTools } from "./docs.js";
import { registerFeedbackTools } from "./feedback.js";
import { registerMilestoneTools } from "./milestones.js";

/** A feedback row the GraphQL `feedbackItem` query would return, body raw. */
function maliciousFeedbackRow() {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    title: "XSS test",
    body: XSS_PAYLOAD,
    status: "Open",
    kind: "Bug",
    voteCount: 3,
    requesterCount: 2,
    visibility: "PUBLIC",
    roadmapItemId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function maliciousCommentRow() {
  return {
    id: "22222222-2222-2222-2222-222222222222",
    body: XSS_PAYLOAD,
    isOfficial: true,
    authorName: "Founder",
    createdAt: "2026-01-02T00:00:00.000Z",
  };
}

describe("sanitize-on-output", () => {
  it("get_feedback strips XSS from the body AND every comment body (both channels)", async () => {
    const cap = createCaptureServer();
    // get_feedback issues two requests: feedbackItem, then feedbackComments.
    const client = createMockClient([
      { feedbackItem: maliciousFeedbackRow() },
      { feedbackComments: [maliciousCommentRow(), maliciousCommentRow()] },
    ]);
    registerFeedbackTools(cap.server, { client });

    const result = await cap
      .get("feedock_get_feedback")
      .run({ id: "11111111-1111-1111-1111-111111111111" });

    expect(result.isError).toBeFalsy();

    // structuredContent — the body and each comment body are sanitized.
    const structured = result.structuredContent as {
      feedback: { body: string };
      comments: { body: string }[];
    };
    expectNoXss(structured.feedback.body);
    expect(structured.feedback.body).toContain("Hello"); // legit text survives
    expect(structured.comments).toHaveLength(2);
    for (const c of structured.comments) {
      expectNoXss(c.body);
    }

    // text block — must carry the SAME sanitized payload (lockstep).
    const text = parseResultText(result) as typeof structured;
    expectNoXss(text.feedback.body);
    for (const c of text.comments) {
      expectNoXss(c.body);
    }
    expect(text).toEqual(structured);
  });

  it("get_doc strips XSS from the doc body (sanitizeDocHtml) in both channels", async () => {
    const cap = createCaptureServer();
    const client = createMockClient([
      {
        doc: {
          id: "33333333-3333-3333-3333-333333333333",
          title: "Spec",
          slug: "spec",
          type: "Freeform",
          customTypeName: "RFC",
          visibility: "PUBLIC",
          milestoneId: null,
          updatedAt: "2026-01-03T00:00:00.000Z",
          body: XSS_PAYLOAD,
        },
      },
    ]);
    registerDocTools(cap.server, { client });

    const result = await cap
      .get("feedock_get_doc")
      .run({ id: "33333333-3333-3333-3333-333333333333" });

    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as {
      doc: { body: string; customTypeName: string | null };
    };
    expectNoXss(structured.doc.body);
    expect(structured.doc.body).toContain("Hello");
    expect(structured.doc.customTypeName).toBe("RFC");

    const text = parseResultText(result) as typeof structured;
    expectNoXss(text.doc.body);
    expect(text).toEqual(structured);
  });

  it("list_changelog strips XSS from each entry body in both channels", async () => {
    const cap = createCaptureServer();
    const entry = (id: string) => ({
      id,
      title: "Release",
      body: XSS_PAYLOAD,
      whyItMatters: "It matters",
      category: "New",
      state: "Published",
      visibility: "PUBLIC",
      slug: `release-${id}`,
      publishedAt: "2026-01-04T00:00:00.000Z",
      requesterCount: 5,
    });
    const client = createMockClient([
      {
        changelogEntries: [
          entry("44444444-4444-4444-4444-444444444444"),
          entry("55555555-5555-5555-5555-555555555555"),
        ],
      },
    ]);
    registerChangelogTools(cap.server, { client });

    const result = await cap.get("feedock_list_changelog").run({});

    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as {
      items: { body: string }[];
    };
    expect(structured.items).toHaveLength(2);
    for (const e of structured.items) {
      expectNoXss(e.body);
      expect(e.body).toContain("Hello");
    }
    const text = parseResultText(result) as typeof structured;
    for (const e of text.items) {
      expectNoXss(e.body);
    }
    expect(text).toEqual(structured);
  });

  it("list_milestones strips XSS from each milestone description in both channels", async () => {
    const cap = createCaptureServer();
    const milestone = (id: string) => ({
      id,
      title: "Milestone",
      description: XSS_PAYLOAD,
      status: "Active",
      visibility: "PUBLIC",
      progressPct: 40,
      taskCount: 5,
      doneTaskCount: 2,
      ownerId: null,
    });
    const client = createMockClient([
      {
        milestones: [
          milestone("77777777-7777-7777-7777-777777777777"),
          milestone("88888888-8888-8888-8888-888888888888"),
        ],
      },
    ]);
    registerMilestoneTools(cap.server, { client });

    const result = await cap.get("feedock_list_milestones").run({});

    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as {
      items: { description: string }[];
    };
    expect(structured.items).toHaveLength(2);
    for (const m of structured.items) {
      expectNoXss(m.description);
      expect(m.description).toContain("Hello"); // legit text survives
    }
    const text = parseResultText(result) as typeof structured;
    for (const m of text.items) {
      expectNoXss(m.description);
    }
    expect(text).toEqual(structured);
  });

  it("get_milestone strips XSS from the milestone's own description", async () => {
    const cap = createCaptureServer();
    const client = createMockClient([
      {
        milestone: {
          id: "99999999-9999-9999-9999-999999999999",
          title: "M2",
          description: XSS_PAYLOAD,
          status: "Active",
          visibility: "PUBLIC",
          progressPct: 50,
          taskCount: 2,
          doneTaskCount: 1,
          ownerId: null,
          tasks: [],
          roadmapItems: [],
          docs: [],
        },
      },
    ]);
    registerMilestoneTools(cap.server, { client });

    const result = await cap
      .get("feedock_get_milestone")
      .run({ id: "99999999-9999-9999-9999-999999999999" });

    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as {
      milestone: { description: string };
    };
    expectNoXss(structured.milestone.description);
    expect(structured.milestone.description).toContain("Hello");
    expect(parseResultText(result)).toEqual(structured);
  });

  it("get_milestone: detail sub-lists carry no body-bearing HTML to leak", async () => {
    // The milestone(id) detail selection projects narrow rows (no task
    // `description`, docs are list rows with no `body`), so there is no
    // rich-text to sanitize — but a malicious value in a NON-rich-text field
    // (e.g. a doc title) must pass through verbatim as data (it is JSON, not
    // injected as HTML by the tool layer), never silently mangled.
    const cap = createCaptureServer();
    const client = createMockClient([
      {
        milestone: {
          id: "66666666-6666-6666-6666-666666666666",
          title: "M1",
          description: null,
          status: "Active",
          visibility: "PUBLIC",
          progressPct: 50,
          taskCount: 2,
          doneTaskCount: 1,
          ownerId: null,
          tasks: [],
          roadmapItems: [],
          docs: [
            {
              id: "55555555-5555-5555-5555-555555555555",
              title: "Architecture",
              slug: "architecture",
              type: "Freeform",
              customTypeName: "RFC",
              visibility: "PRIVATE",
              updatedAt: "2026-01-03T00:00:00.000Z",
            },
          ],
        },
      },
    ]);
    registerMilestoneTools(cap.server, { client });

    const result = await cap
      .get("feedock_get_milestone")
      .run({ id: "66666666-6666-6666-6666-666666666666" });

    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as {
      milestone: { tasks: unknown[]; docs: unknown[] };
    };
    expect(structured.milestone.tasks).toEqual([]);
    expect(structured.milestone.docs).toEqual([
      expect.objectContaining({ customTypeName: "RFC" }),
    ]);
    // No outputSchema `.transform` is relied upon; the mapper is authoritative.
    expect(parseResultText(result)).toEqual(structured);
  });

  it("does NOT rely on the outputSchema to sanitize — the mapper already did", async () => {
    // Regression guard for the §5.3 trap: even if we feed a body that the
    // outputSchema would *accept* unchanged, the value the handler returns is
    // already sanitized by the mapper. Prove sanitization happened pre-schema by
    // checking the raw structuredContent (which the SDK passes through verbatim).
    const cap = createCaptureServer();
    const client = createMockClient([
      { feedbackItem: maliciousFeedbackRow() },
      { feedbackComments: [] },
    ]);
    registerFeedbackTools(cap.server, { client });

    const result = await cap
      .get("feedock_get_feedback")
      .run({ id: "11111111-1111-1111-1111-111111111111" });

    const body = (result.structuredContent as { feedback: { body: string } })
      .feedback.body;
    // The raw stored payload is NOT present verbatim.
    expect(body).not.toContain("<script>");
    expect(body).not.toContain("onerror");
    expect(body).not.toMatch(/javascript:/i);
  });
});
