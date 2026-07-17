/**
 * `feedock_overview` must name the board it is describing.
 *
 * The bug this pins: `project` was read only from the in-process session, which
 * exists solely for ALL-PROJECTS tokens after `feedock_select_project`. A
 * project-bound token has no session, so it reported `project: null` — directly
 * under a comment promising to "say which board this is rather than leaving the
 * agent to guess when several are configured". Bound tokens are exactly the case
 * that cannot guess: they cannot call `mcpProjects` (M-13 refuses them) and
 * `project(id)` needs the id they are trying to discover. With two feedock
 * servers configured, a null here is an agent about to publish — which emails
 * real people — with no idea whose board it is on.
 */

import { describe, expect, it } from "vitest";

import {
  createCaptureServer,
  createMockClient,
  parseResultText,
} from "../test-support.js";
import { registerOverviewTool } from "./overview.js";

const PROJECT = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Feedock",
  slug: "feedock",
};

const EMPTY_LISTS = {
  feedbackList: [],
  roadmapItems: [],
  tasks: [],
  milestones: [],
  changelogEntries: [],
};

/** Answer any list query with an empty page; route CurrentProject separately. */
function respond(currentProject: unknown) {
  return (document: string): unknown => {
    if (document.includes("CurrentProject")) {
      if (currentProject instanceof Error) {
        throw currentProject;
      }
      return { currentProject };
    }
    return EMPTY_LISTS;
  };
}

async function runOverview(ctx: {
  client: ReturnType<typeof createMockClient>;
  session?: Record<string, unknown>;
}) {
  const server = createCaptureServer();
  registerOverviewTool(server.server, ctx as never);
  return server.get("feedock_overview").run({});
}

describe("feedock_overview — names its project", () => {
  it("asks the API which project a BOUND token is scoped to", async () => {
    const client = createMockClient(respond(PROJECT));
    const result = await runOverview({ client, session: undefined });

    expect(parseResultText(result)).toMatchObject({ project: PROJECT });
    // It must actually ask — the identity cannot come from thin air.
    expect(
      client.calls.some((c) => c.document.includes("CurrentProject")),
    ).toBe(true);
  });

  it("uses the session's selection without a round trip when one exists", async () => {
    const client = createMockClient(respond(PROJECT));
    const result = await runOverview({
      client,
      session: {
        projectId: PROJECT.id,
        projectName: PROJECT.name,
        projectSlug: PROJECT.slug,
      },
    });

    expect(parseResultText(result)).toMatchObject({ project: PROJECT });
    // An all-projects token already selected the project; asking again would be
    // a wasted call on every overview.
    expect(
      client.calls.some((c) => c.document.includes("CurrentProject")),
    ).toBe(false);
  });

  // The identity is a nicety; the counts are the point. An API older than
  // currentProject must cost the name, not the snapshot.
  it("still returns the snapshot when the API cannot name the project", async () => {
    const client = createMockClient(respond(new Error("Cannot query field")));
    const result = await runOverview({ client, session: undefined });

    const out = parseResultText(result) as Record<string, unknown>;
    expect(out.project).toBeNull();
    expect(out.openFeedback).toEqual({ count: 0, mayBeTruncated: false });
  });
});
