/**
 * Tool annotations (docs/features/mcp-server.md §5.3). Every registered tool must
 * set ALL FOUR annotation booleans explicitly (the legend marks only non-defaults
 * — the registration always sets the full object), and read-only tools must carry
 * `readOnlyHint:true`. Annotations are hints, not a safety control, but the
 * contract is that they are honest + complete on every tool.
 *
 * This registers the FULL catalog on a capture server and audits each tool.
 */

import { describe, expect, it } from "vitest";

import { createCaptureServer, type CapturedTool } from "../test-support.js";
import { registerAllTools } from "./index.js";

/** The read-only tools (the §5 "Observe" block + the two preview/read tools). */
const READ_ONLY_TOOLS = new Set([
  "feedock_overview",
  "feedock_list_feedback",
  "feedock_get_feedback",
  "feedock_list_roadmap",
  "feedock_list_tasks",
  "feedock_get_task",
  "feedock_list_milestones",
  "feedock_get_milestone",
  "feedock_list_changelog",
  "feedock_list_docs",
  "feedock_get_doc",
  "feedock_list_projects",
  "feedock_preview_changelog_publish",
]);

function buildCatalog(): Map<string, CapturedTool> {
  const cap = createCaptureServer();
  // A no-op client — registration must not call it.
  registerAllTools(cap.server, {
    client: {
      request: async () => {
        throw new Error("registration must not call the client");
      },
    },
  });
  return cap.tools;
}

describe("tool annotations", () => {
  const tools = buildCatalog();

  it("registers a non-empty catalog", () => {
    expect(tools.size).toBeGreaterThanOrEqual(20);
  });

  it("every tool sets all four annotation booleans explicitly", () => {
    for (const [name, tool] of tools) {
      const a = tool.annotations;
      expect(a, `${name} has annotations`).toBeDefined();
      for (const key of [
        "readOnlyHint",
        "destructiveHint",
        "idempotentHint",
        "openWorldHint",
      ] as const) {
        expect(typeof a?.[key], `${name}.${key} is a boolean`).toBe("boolean");
      }
    }
  });

  it("read-only tools have readOnlyHint:true (and are non-destructive)", () => {
    for (const name of READ_ONLY_TOOLS) {
      const tool = tools.get(name);
      expect(tool, `${name} is registered`).toBeDefined();
      expect(tool?.annotations?.readOnlyHint, `${name} readOnlyHint`).toBe(
        true,
      );
      expect(
        tool?.annotations?.destructiveHint,
        `${name} not destructive`,
      ).toBe(false);
    }
  });

  it("write tools are NOT read-only", () => {
    for (const [name, tool] of tools) {
      if (READ_ONLY_TOOLS.has(name)) {
        continue;
      }
      expect(tool.annotations?.readOnlyHint, `${name} is a write tool`).toBe(
        false,
      );
    }
  });

  it("the destructive tools (merge, publish) carry destructiveHint:true", () => {
    for (const name of [
      "feedock_merge_feedback",
      "feedock_publish_changelog",
    ]) {
      expect(tools.get(name)?.annotations?.destructiveHint, name).toBe(true);
    }
  });

  it("publish_changelog is openWorld (it emails — touches the outside world)", () => {
    expect(
      tools.get("feedock_publish_changelog")?.annotations?.openWorldHint,
    ).toBe(true);
  });

  it("status/move tools are NOT marked idempotent (they re-fire effects — §5.2)", () => {
    for (const name of [
      "feedock_update_feedback_status",
      "feedock_update_task_status",
      "feedock_move_roadmap_item",
    ]) {
      expect(tools.get(name)?.annotations?.idempotentHint, name).toBe(false);
    }
  });

  it("every tool has a title + description (model-facing copy)", () => {
    for (const [name, tool] of tools) {
      expect(tool.title, `${name} title`).toBeTruthy();
      expect(
        (tool.description ?? "").length,
        `${name} description`,
      ).toBeGreaterThan(20);
    }
  });
});
