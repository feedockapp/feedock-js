/**
 * The project tools for USER-SCOPED tokens (docs/features/mcp-server.md §3.4):
 * list shows what the API returns (the server-side mcpEnabled filter is the
 * API's job — pinned in project.service.spec there); select writes the shared
 * session only after a match, so an unknown id/slug can never route requests.
 */

import { describe, expect, it } from "vitest";

import type { ProjectSession } from "../client/project-session.js";
import { createCaptureServer, createMockClient } from "../test-support.js";
import { registerProjectTools } from "./projects.js";

const P1 = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Mobile App",
  slug: "mobile-app",
};
const P2 = {
  id: "bbbbbbbb-bbbb-4bbb-9bbb-bbbbbbbbbbbb",
  name: "Website",
  slug: "website",
};

function catalog(
  responses: unknown[],
  session: ProjectSession | undefined = {},
) {
  const cap = createCaptureServer();
  const client = createMockClient(responses);
  registerProjectTools(cap.server, { client, session });
  return { cap, client, session };
}

describe("feedock_list_projects", () => {
  it("returns the API's projects plus the current selection", async () => {
    const { cap } = catalog([{ mcpProjects: [P1, P2] }], { projectId: P1.id });
    const result = await cap.get("feedock_list_projects").run({});
    expect(result.structuredContent).toEqual({
      items: [P1, P2],
      selectedProjectId: P1.id,
    });
  });

  it("surfaces the API's bound-token refusal as a tool error", async () => {
    const { cap } = catalog([new Error("This token is bound to one project.")]);
    const result = await cap.get("feedock_list_projects").run({});
    expect(result.isError).toBe(true);
  });
});

describe("feedock_select_project", () => {
  it("selects by slug and writes the shared session", async () => {
    const { cap, session } = catalog([{ mcpProjects: [P1, P2] }]);
    const result = await cap
      .get("feedock_select_project")
      .run({ slug: "website" });
    expect(result.structuredContent).toEqual({ project: P2 });
    expect(session).toEqual({
      projectId: P2.id,
      projectName: P2.name,
      projectSlug: P2.slug,
    });
  });

  it("selects by id", async () => {
    const { cap, session } = catalog([{ mcpProjects: [P1, P2] }]);
    await cap.get("feedock_select_project").run({ id: P1.id });
    expect(session?.projectId).toBe(P1.id);
  });

  it("rejects an unknown target, names the available projects, and leaves the session untouched", async () => {
    const { cap, session } = catalog([{ mcpProjects: [P1] }]);
    const result = await cap
      .get("feedock_select_project")
      .run({ slug: "nope" });
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain(
      "Mobile App (mobile-app)",
    );
    expect(session).toEqual({});
  });

  it("errors without id or slug — before any API call", async () => {
    const { cap, client } = catalog([]);
    const result = await cap.get("feedock_select_project").run({});
    expect(result.isError).toBe(true);
    expect(client.calls).toHaveLength(0);
  });
});
