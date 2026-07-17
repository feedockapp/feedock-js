/**
 * `feedock_update_roadmap_item` — the edit that was missing.
 *
 * The MCP could CREATE a roadmap item and then never correct it: the API has
 * `updateRoadmapItem`, the MCP never exposed it. So an item drafted through an
 * agent was frozen at whatever it was first written as — which bit for real when
 * a roadmap item landed with unconverted markdown and nothing could fix it.
 *
 * The interesting part is the M-27 gate. Create only has to ask "is this call
 * making something public?", which the args answer. Edit also has to ask "is this
 * thing ALREADY public?", which they do not — an edit to live public copy is a
 * public write even when the call says nothing about visibility. So the tool
 * reads the item first. Guessing from the args would leave the common case —
 * editing published copy — completely ungated.
 */

import { describe, expect, it } from "vitest";

import { createCaptureServer, createMockClient } from "../test-support.js";
import { registerRoadmapTools } from "./roadmap.js";

const ID = "11111111-1111-1111-1111-111111111111";

function row(visibility: "PUBLIC" | "PRIVATE") {
  return {
    id: ID,
    title: "t",
    description: "<p>x</p>",
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

/** Answer the read with `current`, the mutation with the same row. */
function client(current: "PUBLIC" | "PRIVATE") {
  return createMockClient((document: string) =>
    document.includes("query RoadmapItem")
      ? { roadmapItem: row(current) }
      : { updateRoadmapItem: row(current) },
  );
}

async function run(c: ReturnType<typeof client>, args: Record<string, unknown>) {
  const server = createCaptureServer();
  registerRoadmapTools(server.server, { client: c } as never);
  return server.get("feedock_update_roadmap_item").run(args);
}

describe("feedock_update_roadmap_item — the public-write gate", () => {
  it("edits a PRIVATE item without ceremony", async () => {
    const c = client("PRIVATE");
    const result = await run(c, { id: ID, description: "## Fixed" });

    expect(result.isError).toBeFalsy();
    expect(c.calls.some((x) => x.document.includes("UpdateRoadmapItem"))).toBe(
      true,
    );
  });

  // The case a create-shaped gate would miss entirely.
  it("refuses to edit an ALREADY-PUBLIC item without confirm", async () => {
    const c = client("PUBLIC");
    const result = await run(c, { id: ID, description: "new copy" });

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("PUBLIC");
    // Nothing may reach the API before the human has seen it.
    expect(c.calls.some((x) => x.document.includes("UpdateRoadmapItem"))).toBe(
      false,
    );
  });

  it("refuses to TURN an item public without confirm", async () => {
    const c = client("PRIVATE");
    const result = await run(c, { id: ID, visibility: "PUBLIC" });

    expect(result.isError).toBe(true);
    expect(c.calls.some((x) => x.document.includes("UpdateRoadmapItem"))).toBe(
      false,
    );
  });

  it("lets a confirmed public edit through", async () => {
    const c = client("PUBLIC");
    const result = await run(c, { id: ID, description: "x", confirm: true });

    expect(result.isError).toBeFalsy();
    expect(c.calls.some((x) => x.document.includes("UpdateRoadmapItem"))).toBe(
      true,
    );
  });

  // Making something PRIVATE cannot leak it, so it should not need a confirm.
  it("does not gate taking an item private", async () => {
    const c = client("PUBLIC");
    const result = await run(c, { id: ID, visibility: "PRIVATE" });

    expect(result.isError).toBeFalsy();
  });

  it("converts markdown in the description", async () => {
    const c = client("PRIVATE");
    await run(c, { id: ID, description: "## Heading\n\n`code`" });

    const sent = JSON.stringify(c.calls.at(-1)?.variables ?? {});
    expect(sent).toContain("<h2>Heading</h2>");
    expect(sent).not.toContain("## Heading");
  });
});
