/**
 * EVERY rich-text write converts markdown → HTML before it leaves the tool.
 *
 * Models write markdown; every Feedock rich-text surface stores HTML. A tool that
 * forwards the raw string puts literal `##` and backticks on the founder's board.
 * That was fixed once for tasks/docs/changelog — and missed for roadmap and
 * feedback comments, which is how a roadmap item drafted through the MCP landed
 * as unrendered markdown.
 *
 * Feedback comments are the subtle one: the public mapper renders a comment as
 * rich text only when `comment.isOfficial && looksLikeRichHtml(comment.body)`,
 * and escapes it otherwise. MCP comments ARE official (`isOfficial: true` in
 * FeedbackService.addComment), so markdown fails the looksLikeRichHtml test and
 * reaches the reader verbatim.
 *
 * This sweeps the write tools rather than testing one, so the next tool to grow a
 * rich-text field cannot quietly skip the conversion.
 */

import { describe, expect, it } from "vitest";

import { createCaptureServer, createMockClient } from "../test-support.js";
import { registerFeedbackTools } from "./feedback.js";
import { registerRoadmapTools } from "./roadmap.js";

const ID = "11111111-1111-1111-1111-111111111111";
const MARKDOWN = "## Heading\n\nSome `code` and **bold**.";

/** Every mutation echoes a minimal row back so the mapper does not explode. */
const ROW = {
  createRoadmapItem: {
    id: ID,
    title: "t",
    description: "<p>x</p>",
    column: "Later",
    visibility: "PRIVATE",
    targetWindow: null,
    milestoneId: null,
    peopleAsked: 0,
    feedbackCount: 0,
    taskCount: 0,
    shippedAt: null,
  },
  addFeedbackComment: {
    id: ID,
    body: "<p>x</p>",
    isOfficial: true,
    authorName: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
};

/** The variables the tool actually sent for a given markdown input. */
async function sentBy(
  register: (s: never, c: never) => void,
  tool: string,
  args: Record<string, unknown>,
): Promise<string> {
  const client = createMockClient(() => ROW);
  const server = createCaptureServer();
  register(server.server as never, { client, session: undefined } as never);
  await server.get(tool).run(args);
  const call = client.calls.at(-1);
  return JSON.stringify(call?.variables ?? {});
}

describe("rich-text writes convert markdown before sending", () => {
  it("feedock_create_roadmap_item converts its description", async () => {
    const sent = await sentBy(registerRoadmapTools, "feedock_create_roadmap_item", {
      title: "Track releases",
      description: MARKDOWN,
      visibility: "PRIVATE",
    });

    expect(sent).toContain("<h2>Heading</h2>");
    expect(sent).toContain("<code>code</code>");
    // The raw markers must not survive — that is the bug.
    expect(sent).not.toContain("## Heading");
  });

  it("feedock_add_feedback_comment converts its body", async () => {
    const sent = await sentBy(registerFeedbackTools, "feedock_add_feedback_comment", {
      id: ID,
      body: MARKDOWN,
      confirm: true,
    });

    expect(sent).toContain("<h2>Heading</h2>");
    expect(sent).not.toContain("## Heading");
  });

  // Conversion must not become a new injection path: the shared allow-list runs
  // last, so HTML smuggled through markdown cannot survive into a write.
  it("does not let markdown smuggle a script tag into a write", async () => {
    const sent = await sentBy(registerRoadmapTools, "feedock_create_roadmap_item", {
      title: "x",
      description: "hi\n\n<script>alert(1)</script>",
      visibility: "PRIVATE",
    });

    expect(sent).not.toContain("<script>");
  });
});
