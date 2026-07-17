/**
 * The task/doc WRITE tools (docs/features/mcp-server.md §5 + §5.1):
 *
 *  - the delete tools' `confirm: z.literal(true)` rejects absent/false at the
 *    schema (the SDK's first line of friction);
 *  - the doc tools' conditional PUBLIC gate is HANDLER-enforced (schema can't
 *    express "confirm required only when visibility=PUBLIC") — a PUBLIC write
 *    without confirm returns isError and NEVER calls the client;
 *  - update_task forwards explicit nulls (clear semantics) and omits absent
 *    fields — the API treats absent as "leave untouched";
 *  - every body-bearing response is sanitized in the mapper before it reaches
 *    either output channel (§5.3).
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createCaptureServer, createMockClient } from "../test-support.js";
import { registerDocTools } from "./docs.js";
import { registerTaskTools } from "./tasks.js";

const TASK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DOC_ID = "bbbbbbbb-bbbb-4bbb-9bbb-bbbbbbbbbbbb";
const XSS = "<p>ok</p><script>alert(1)</script>";

const API_TASK = {
  id: TASK_ID,
  number: 7,
  title: "Ship it",
  description: XSS,
  status: "Planned",
  priority: "High",
  assigneeId: null,
  milestoneId: null,
  roadmapItemId: null,
  dueDate: null,
  completedAt: null,
  createdAt: "2026-07-01T00:00:00.000Z",
};

const API_DOC = {
  id: DOC_ID,
  title: "Launch plan",
  slug: "launch-plan",
  type: "Prd",
  customTypeName: null,
  visibility: "PRIVATE",
  milestoneId: null,
  body: XSS,
  updatedAt: "2026-07-01T00:00:00.000Z",
};

function taskCatalog(responses: unknown[]) {
  const cap = createCaptureServer();
  const client = createMockClient(responses);
  registerTaskTools(cap.server, { client });
  return { cap, client };
}

function docCatalog(responses: unknown[]) {
  const cap = createCaptureServer();
  const client = createMockClient(responses);
  registerDocTools(cap.server, { client });
  return { cap, client };
}

describe("delete confirm friction (schema level)", () => {
  it.each([
    ["feedock_delete_task", taskCatalog([])] as const,
    ["feedock_delete_doc", docCatalog([])] as const,
  ])("%s requires the literal confirm:true", (name, { cap }) => {
    const Input = z.object(
      cap.get(name).inputSchema as Record<string, z.ZodTypeAny>,
    );
    const id = name.includes("task") ? TASK_ID : DOC_ID;
    expect(Input.safeParse({ id }).success).toBe(false);
    expect(Input.safeParse({ id, confirm: false }).success).toBe(false);
    expect(Input.safeParse({ id, confirm: true }).success).toBe(true);
  });
});

describe("PUBLIC doc gate (handler level)", () => {
  it("create_doc PUBLIC without confirm errors and never calls the API", async () => {
    const { cap, client } = docCatalog([]);
    const result = await cap
      .get("feedock_create_doc")
      .run({ title: "Plan", visibility: "PUBLIC" });
    expect(result.isError).toBe(true);
    expect(client.calls).toHaveLength(0);
  });

  it("update_doc flipping PUBLIC without confirm errors and never calls the API", async () => {
    const { cap, client } = docCatalog([]);
    const result = await cap
      .get("feedock_update_doc")
      .run({ id: DOC_ID, visibility: "PUBLIC" });
    expect(result.isError).toBe(true);
    expect(client.calls).toHaveLength(0);
  });

  it("create_doc PUBLIC with confirm proceeds — and confirm never reaches the API input", async () => {
    const { cap, client } = docCatalog([
      { createDoc: { ...API_DOC, visibility: "PUBLIC" } },
    ]);
    const result = await cap
      .get("feedock_create_doc")
      .run({ title: "Plan", visibility: "PUBLIC", confirm: true });
    expect(result.isError).toBeUndefined();
    const input = (client.calls[0]?.variables as { input: object }).input;
    expect(input).toEqual({ title: "Plan", visibility: "PUBLIC" });
  });

  it("PRIVATE create needs no confirm", async () => {
    const { cap, client } = docCatalog([{ createDoc: API_DOC }]);
    const result = await cap.get("feedock_create_doc").run({ title: "Plan" });
    expect(result.isError).toBeUndefined();
    expect(client.calls).toHaveLength(1);
  });
});

describe("update_task null-clear semantics", () => {
  it("forwards explicit nulls, omits absent fields", async () => {
    const { cap, client } = taskCatalog([{ updateTask: API_TASK }]);
    await cap.get("feedock_update_task").run({
      id: TASK_ID,
      title: "Ship it",
      assigneeId: null,
      dueDate: null,
    });
    const input = (client.calls[0]?.variables as { input: object }).input;
    expect(input).toEqual({
      id: TASK_ID,
      title: "Ship it",
      assigneeId: null,
      dueDate: null,
    });
  });
});

describe("task write forwards multi-assignee, labels, and start date", () => {
  const A = "11111111-1111-4111-8111-111111111111";
  const B = "22222222-2222-4222-8222-222222222222";
  const L = "33333333-3333-4333-8333-333333333333";

  it("update_task forwards assigneeIds, labelIds, and startDate (empty array clears)", async () => {
    const { cap, client } = taskCatalog([{ updateTask: API_TASK }]);
    await cap.get("feedock_update_task").run({
      id: TASK_ID,
      assigneeIds: [A, B],
      labelIds: [],
      startDate: "2026-08-01T00:00:00Z",
    });
    const input = (client.calls[0]?.variables as { input: object }).input;
    expect(input).toEqual({
      id: TASK_ID,
      assigneeIds: [A, B],
      labelIds: [],
      startDate: "2026-08-01T00:00:00Z",
    });
  });

  it("create_task forwards assigneeIds, labelIds, and startDate", async () => {
    const { cap, client } = taskCatalog([{ createTask: API_TASK }]);
    await cap.get("feedock_create_task").run({
      title: "Ship it",
      assigneeIds: [A],
      labelIds: [L],
      startDate: "2026-08-01T00:00:00Z",
    });
    const input = (client.calls[0]?.variables as { input: object }).input;
    expect(input).toEqual({
      title: "Ship it",
      assigneeIds: [A],
      labelIds: [L],
      startDate: "2026-08-01T00:00:00Z",
    });
  });
});

describe("write responses sanitize rich text in both channels", () => {
  it.each([
    [
      "feedock_update_task",
      taskCatalog([{ updateTask: API_TASK }]),
      { id: TASK_ID, title: "x" },
    ] as const,
    [
      "feedock_create_doc",
      docCatalog([{ createDoc: API_DOC }]),
      { title: "Plan" },
    ] as const,
    [
      "feedock_update_doc",
      docCatalog([{ updateDoc: API_DOC }]),
      { id: DOC_ID, title: "Plan" },
    ] as const,
  ])("%s strips XSS", async (name, { cap }, args) => {
    const result = await cap.get(name).run(args as Record<string, unknown>);
    const text = (result.content[0] as { text: string }).text;
    const structured = JSON.stringify(result.structuredContent);
    expect(text).not.toContain("<script>");
    expect(structured).not.toContain("<script>");
    expect(text).toContain("<p>ok</p>");
  });
});

describe("delete tools", () => {
  it("delete_task returns { deleted, id } after the mutation", async () => {
    const { cap, client } = taskCatalog([{ deleteTask: true }]);
    const result = await cap
      .get("feedock_delete_task")
      .run({ id: TASK_ID, confirm: true });
    expect(result.structuredContent).toEqual({ deleted: true, id: TASK_ID });
    expect(client.calls).toHaveLength(1);
  });

  it("delete_doc surfaces an API failure as a tool error", async () => {
    const { cap } = docCatalog([new Error("Forbidden")]);
    const result = await cap
      .get("feedock_delete_doc")
      .run({ id: DOC_ID, confirm: true });
    expect(result.isError).toBe(true);
  });
});
