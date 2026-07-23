/**
 * The milestone WRITE tools (docs/features/mcp-server.md §5 + §5.1 + §5.3).
 *
 * Milestones were read-only until an agent asked to group tasks under one and
 * found creation was dashboard-only. The write pair closes that gap, so these
 * tests pin the contract the pair has to keep:
 *
 *  - the PUBLIC gate is HANDLER-enforced (a schema can't express "confirm
 *    required only when visibility=PUBLIC"). A PUBLIC milestone's title, status
 *    and live progress show on the public roadmap, so update gates on the
 *    milestone being PUBLIC **or becoming** PUBLIC — it READS the current
 *    visibility instead of trusting the args, which is what keeps the common
 *    case (editing already-published copy) from slipping through ungated;
 *  - a blocked write never reaches the mutation;
 *  - `confirm` is tool-level friction, not an API field — it must never appear
 *    in the GraphQL input;
 *  - the description is rich text: markdown in, HTML out, converted before it
 *    leaves the tool (a raw forward puts literal `##` on the founder's board);
 *  - update forwards explicit nulls (clear semantics) and omits absent fields —
 *    the API treats absent as "leave untouched";
 *  - progress is DERIVED from the linked tasks, so it must not be settable;
 *  - the echoed description is sanitized in the mapper before it reaches either
 *    output channel (§5.3).
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createCaptureServer, createMockClient } from "../test-support.js";
import { registerMilestoneTools } from "./milestones.js";

const MILESTONE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OWNER_ID = "dddddddd-dddd-4ddd-9ddd-dddddddddddd";
const XSS = "<p>ok</p><script>alert(1)</script>";
const MARKDOWN = "## Scope\n\nShip the **loop** with `tasks`.";

/** What MILESTONE_FIELDS selects — echoed back so the mapper does not explode. */
const API_MILESTONE = {
  id: MILESTONE_ID,
  title: "v1 launch",
  description: XSS,
  status: "Planned",
  visibility: "PRIVATE",
  progressPct: 0,
  taskCount: 0,
  doneTaskCount: 0,
  ownerId: null,
  startDate: "2026-08-01T00:00:00.000Z",
  softTargetDate: "2026-10-01T00:00:00.000Z",
  softTargetPrecision: "Quarter",
};

/** The update tool's pre-flight visibility read (the gate's input). */
const CURRENTLY_PRIVATE = { milestone: { visibility: "PRIVATE" } };
const CURRENTLY_PUBLIC = { milestone: { visibility: "PUBLIC" } };

function milestoneCatalog(responses: unknown[]) {
  const cap = createCaptureServer();
  const client = createMockClient(responses);
  registerMilestoneTools(cap.server, { client });
  return { cap, client };
}

type Calls = { calls: { query?: unknown; variables?: unknown }[] };

/**
 * The `input` the tool built for the MUTATION. Update pre-reads the current
 * visibility first, so the mutation is the LAST call, not the first.
 */
function mutationInput(client: Calls) {
  const last = client.calls[client.calls.length - 1];
  return (last?.variables as { input: Record<string, unknown> }).input;
}

/** Calls that carry an `input` variable — i.e. the writes, not the gate's read. */
function mutationCalls(client: Calls) {
  return client.calls.filter(
    (c) =>
      (c.variables as { input?: unknown } | undefined)?.input !== undefined,
  );
}

describe("create_milestone PUBLIC confirm friction", () => {
  it("PUBLIC without confirm errors and never calls the API", async () => {
    const { cap, client } = milestoneCatalog([]);
    const result = await cap
      .get("feedock_create_milestone")
      .run({ title: "v1 launch", visibility: "PUBLIC" });
    expect(result.isError).toBe(true);
    expect(client.calls).toHaveLength(0);
  });

  it("PUBLIC with confirm proceeds — confirm never reaches the API input", async () => {
    const { cap, client } = milestoneCatalog([
      { createMilestone: { ...API_MILESTONE, visibility: "PUBLIC" } },
    ]);
    const result = await cap
      .get("feedock_create_milestone")
      .run({ title: "v1 launch", visibility: "PUBLIC", confirm: true });
    expect(result.isError).toBeUndefined();
    expect(mutationInput(client)).toEqual({
      title: "v1 launch",
      visibility: "PUBLIC",
    });
  });

  it("a PRIVATE create needs no confirm", async () => {
    const { cap, client } = milestoneCatalog([
      { createMilestone: API_MILESTONE },
    ]);
    const result = await cap
      .get("feedock_create_milestone")
      .run({ title: "v1 launch" });
    expect(result.isError).toBeUndefined();
    expect(mutationCalls(client)).toHaveLength(1);
  });
});

describe("update_milestone gates on the CURRENT visibility", () => {
  it("editing an already-PUBLIC milestone without confirm is blocked before the mutation", async () => {
    const { cap, client } = milestoneCatalog([CURRENTLY_PUBLIC]);
    const result = await cap
      .get("feedock_update_milestone")
      .run({ id: MILESTONE_ID, title: "renamed by injected text" });
    expect(result.isError).toBe(true);
    // It read the visibility, but never wrote.
    expect(mutationCalls(client)).toHaveLength(0);
  });

  it("editing an already-PUBLIC milestone WITH confirm proceeds", async () => {
    const { cap, client } = milestoneCatalog([
      CURRENTLY_PUBLIC,
      { updateMilestone: { ...API_MILESTONE, visibility: "PUBLIC" } },
    ]);
    const result = await cap
      .get("feedock_update_milestone")
      .run({ id: MILESTONE_ID, title: "v1.1 launch", confirm: true });
    expect(result.isError).toBeUndefined();
    expect(mutationInput(client)).toEqual({
      id: MILESTONE_ID,
      title: "v1.1 launch",
    });
  });

  it("flipping a PRIVATE milestone PUBLIC without confirm is blocked", async () => {
    const { cap, client } = milestoneCatalog([CURRENTLY_PRIVATE]);
    const result = await cap
      .get("feedock_update_milestone")
      .run({ id: MILESTONE_ID, visibility: "PUBLIC" });
    expect(result.isError).toBe(true);
    expect(mutationCalls(client)).toHaveLength(0);
  });

  it("editing a PRIVATE milestone needs no confirm", async () => {
    const { cap, client } = milestoneCatalog([
      CURRENTLY_PRIVATE,
      { updateMilestone: API_MILESTONE },
    ]);
    const result = await cap
      .get("feedock_update_milestone")
      .run({ id: MILESTONE_ID, title: "still private" });
    expect(result.isError).toBeUndefined();
    expect(mutationCalls(client)).toHaveLength(1);
  });

  it("un-publishing (explicit PRIVATE) needs no confirm — it removes public copy", async () => {
    const { cap, client } = milestoneCatalog([
      CURRENTLY_PUBLIC,
      { updateMilestone: API_MILESTONE },
    ]);
    const result = await cap
      .get("feedock_update_milestone")
      .run({ id: MILESTONE_ID, visibility: "PRIVATE" });
    expect(result.isError).toBeUndefined();
    expect(mutationInput(client)).toEqual({
      id: MILESTONE_ID,
      visibility: "PRIVATE",
    });
  });

  it("a missing milestone errors without writing", async () => {
    const { cap, client } = milestoneCatalog([{ milestone: null }]);
    const result = await cap
      .get("feedock_update_milestone")
      .run({ id: MILESTONE_ID, title: "nope" });
    expect(result.isError).toBe(true);
    expect(mutationCalls(client)).toHaveLength(0);
  });
});

describe("milestone rich-text writes", () => {
  it("create converts the markdown description to HTML", async () => {
    const { cap, client } = milestoneCatalog([
      { createMilestone: API_MILESTONE },
    ]);
    await cap
      .get("feedock_create_milestone")
      .run({ title: "v1 launch", description: MARKDOWN });
    const description = mutationInput(client).description as string;
    expect(description).toContain("<h2>");
    expect(description).toContain("<strong>");
    expect(description).not.toContain("## Scope");
  });

  it("update converts the markdown description to HTML", async () => {
    const { cap, client } = milestoneCatalog([
      CURRENTLY_PRIVATE,
      { updateMilestone: API_MILESTONE },
    ]);
    await cap
      .get("feedock_update_milestone")
      .run({ id: MILESTONE_ID, description: MARKDOWN });
    const description = mutationInput(client).description as string;
    expect(description).toContain("<h2>");
    expect(description).not.toContain("## Scope");
  });
});

describe("update_milestone null-clear semantics", () => {
  it("forwards explicit nulls, omits absent fields", async () => {
    const { cap, client } = milestoneCatalog([
      CURRENTLY_PRIVATE,
      { updateMilestone: API_MILESTONE },
    ]);
    await cap.get("feedock_update_milestone").run({
      id: MILESTONE_ID,
      status: "Active",
      description: null,
      ownerId: null,
    });
    expect(mutationInput(client)).toEqual({
      id: MILESTONE_ID,
      status: "Active",
      description: null,
      ownerId: null,
    });
  });

  it("sends only the id when nothing else is supplied", async () => {
    const { cap, client } = milestoneCatalog([
      CURRENTLY_PRIVATE,
      { updateMilestone: API_MILESTONE },
    ]);
    await cap.get("feedock_update_milestone").run({ id: MILESTONE_ID });
    expect(mutationInput(client)).toEqual({ id: MILESTONE_ID });
  });

  it("moves the lifecycle to Shipped", async () => {
    const { cap, client } = milestoneCatalog([
      CURRENTLY_PRIVATE,
      {
        updateMilestone: {
          ...API_MILESTONE,
          status: "Shipped",
          progressPct: 100,
        },
      },
    ]);
    const result = await cap
      .get("feedock_update_milestone")
      .run({ id: MILESTONE_ID, status: "Shipped" });
    expect(result.isError).toBeUndefined();
    expect(mutationInput(client).status).toBe("Shipped");
    expect(
      (result.structuredContent as { milestone: { progressPct: number } })
        .milestone.progressPct,
    ).toBe(100);
  });
});

describe("derived progress is not settable", () => {
  it.each(["feedock_create_milestone", "feedock_update_milestone"])(
    "%s exposes no progress/count inputs",
    (name) => {
      const { cap } = milestoneCatalog([]);
      const shape = cap.get(name).inputSchema as Record<string, z.ZodTypeAny>;
      expect(Object.keys(shape)).not.toContain("progressPct");
      expect(Object.keys(shape)).not.toContain("taskCount");
      expect(Object.keys(shape)).not.toContain("doneTaskCount");
    },
  );
});

describe("milestone write responses are sanitized", () => {
  it.each([
    [
      "feedock_create_milestone",
      [{ createMilestone: API_MILESTONE }],
      { title: "v1 launch" },
    ],
    [
      "feedock_update_milestone",
      [CURRENTLY_PRIVATE, { updateMilestone: API_MILESTONE }],
      { id: MILESTONE_ID },
    ],
  ] as const)(
    "%s strips script from the echoed description",
    async (name, responses, args) => {
      const { cap } = milestoneCatalog([...responses]);
      const result = await cap.get(name).run(args);
      const { milestone } = result.structuredContent as {
        milestone: { description: string };
      };
      expect(milestone.description).not.toContain("<script>");
      expect(milestone.description).toContain("<p>ok</p>");
      // The text channel carries the same sanitized payload (§5.3).
      expect(JSON.stringify(result.content)).not.toContain("<script>");
    },
  );
});

describe("planning dates round-trip", () => {
  it("create forwards the dates and precision", async () => {
    const { cap, client } = milestoneCatalog([
      { createMilestone: API_MILESTONE },
    ]);
    await cap.get("feedock_create_milestone").run({
      title: "v1 launch",
      startDate: "2026-08-01",
      softTargetDate: "2026-10-01",
      softTargetPrecision: "Quarter",
    });
    expect(mutationInput(client)).toEqual({
      title: "v1 launch",
      startDate: "2026-08-01",
      softTargetDate: "2026-10-01",
      softTargetPrecision: "Quarter",
    });
  });

  it("the created milestone reads its dates back", async () => {
    const { cap } = milestoneCatalog([{ createMilestone: API_MILESTONE }]);
    const result = await cap
      .get("feedock_create_milestone")
      .run({ title: "v1 launch" });
    const { milestone } = result.structuredContent as {
      milestone: {
        startDate: string | null;
        softTargetDate: string | null;
        softTargetPrecision: string | null;
      };
    };
    expect(milestone.startDate).toBe("2026-08-01T00:00:00.000Z");
    expect(milestone.softTargetDate).toBe("2026-10-01T00:00:00.000Z");
    expect(milestone.softTargetPrecision).toBe("Quarter");
  });

  it("update clears dates with explicit null and leaves absent ones untouched", async () => {
    const { cap, client } = milestoneCatalog([
      CURRENTLY_PRIVATE,
      { updateMilestone: { ...API_MILESTONE, softTargetDate: null } },
    ]);
    await cap.get("feedock_update_milestone").run({
      id: MILESTONE_ID,
      softTargetDate: null,
    });
    // startDate absent → omitted; softTargetDate null → forwarded to clear.
    expect(mutationInput(client)).toEqual({
      id: MILESTONE_ID,
      softTargetDate: null,
    });
  });
});

/**
 * The capture server records `outputSchema` but does not enforce it — the real
 * SDK does. Without this, widening MilestoneItem (as the dates did) and
 * forgetting the mapper would pass every other test here and only fail against a
 * live client.
 */
describe("write results satisfy the declared outputSchema", () => {
  it.each([
    [
      "feedock_create_milestone",
      [{ createMilestone: API_MILESTONE }],
      { title: "v1 launch" },
    ],
    [
      "feedock_update_milestone",
      [CURRENTLY_PRIVATE, { updateMilestone: API_MILESTONE }],
      { id: MILESTONE_ID },
    ],
  ] as const)("%s", async (name, responses, args) => {
    const { cap } = milestoneCatalog([...responses]);
    const tool = cap.get(name);
    const result = await tool.run(args);
    const Output = z.object(
      tool.outputSchema as unknown as Record<string, z.ZodTypeAny>,
    );
    expect(Output.safeParse(result.structuredContent).success).toBe(true);

    // ...and prove the check isn't vacuous: drop one mapped field and it fails.
    const { milestone } = result.structuredContent as {
      milestone: Record<string, unknown>;
    };
    const { startDate: _dropped, ...missingADate } = milestone;
    expect(Output.safeParse({ milestone: missingADate }).success).toBe(false);
  });
});

describe("owner + status pass through on create", () => {
  it("forwards ownerId and status, omitting what was not sent", async () => {
    const { cap, client } = milestoneCatalog([
      { createMilestone: { ...API_MILESTONE, ownerId: OWNER_ID } },
    ]);
    await cap.get("feedock_create_milestone").run({
      title: "v1 launch",
      status: "Active",
      ownerId: OWNER_ID,
    });
    expect(mutationInput(client)).toEqual({
      title: "v1 launch",
      status: "Active",
      ownerId: OWNER_ID,
    });
  });
});
