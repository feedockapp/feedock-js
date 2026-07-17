/**
 * Error shape (docs/features/mcp-server.md §5.3 + §6 rules 4/6). Tools never
 * throw across the MCP boundary — every failure is an `isError` result with an
 * actionable, secret-free message and **no `structuredContent`**. API failures
 * map to safe hints; a stack trace, SQL, or token must never leak.
 */

import { ClientError } from "graphql-request";
import { describe, expect, it } from "vitest";

import { apiErrorMessage, toApiToolError, toToolError } from "./errors.js";

/** Build a `graphql-request` ClientError with the given errors[] / status. */
function clientError(
  errors: { message: string; extensions?: Record<string, unknown> }[],
  status = 200,
): ClientError {
  return new ClientError(
    {
      errors: errors as never,
      status,
      headers: new Headers(),
      body: "",
    },
    { query: "query {}" },
  );
}

describe("toToolError", () => {
  it("returns { isError:true, content:[{type:'text'}] } with NO structuredContent", () => {
    const result = toToolError("nope");
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: "nope" }]);
    expect("structuredContent" in result).toBe(false);
  });
});

describe("apiErrorMessage — safe mapping", () => {
  it("maps UNAUTHENTICATED to the token-revoked hint (no raw error)", () => {
    const msg = apiErrorMessage(
      clientError([
        { message: "ctx broke", extensions: { code: "UNAUTHENTICATED" } },
      ]),
    );
    expect(msg).toMatch(/token may be revoked or expired/i);
  });

  it("maps FORBIDDEN, surfacing the actionable server message", () => {
    const msg = apiErrorMessage(
      clientError([
        {
          message: "Requires Owner or Admin role",
          extensions: { code: "FORBIDDEN" },
        },
      ]),
    );
    expect(msg).toBe("Requires Owner or Admin role");
  });

  it("maps BAD_USER_INPUT, surfacing the actionable server message", () => {
    const msg = apiErrorMessage(
      clientError([
        {
          message:
            "Feedback abc is already merged into def — operate on the canonical item.",
          extensions: { code: "BAD_USER_INPUT" },
        },
      ]),
    );
    expect(msg).toContain("already merged into");
  });

  it("maps NOT_FOUND, surfacing the actionable server message", () => {
    const msg = apiErrorMessage(
      clientError([
        { message: "Feedback not found.", extensions: { code: "NOT_FOUND" } },
      ]),
    );
    expect(msg).toBe("Feedback not found.");
  });

  it("never echoes the server message for INTERNAL_SERVER_ERROR (no internals leak)", () => {
    const leak =
      "Cannot read properties of undefined (reading 'project') at TaskService.findFirst (/app/dist/task.service.js:42)";
    const msg = apiErrorMessage(
      clientError(
        [{ message: leak, extensions: { code: "INTERNAL_SERVER_ERROR" } }],
        500,
      ),
    );
    expect(msg).not.toContain("undefined");
    expect(msg).not.toContain("TaskService");
    expect(msg).not.toContain(".js:");
    // Falls through to the safe status hint, never the raw server message.
    expect(msg).toMatch(/internal error/i);
  });

  it("never echoes the server message for an UNKNOWN/unmapped code", () => {
    const leak = "P2002 Unique constraint failed on the fields: (`tokenHash`)";
    const msg = apiErrorMessage(
      clientError([
        { message: leak, extensions: { code: "SOME_NEW_PRISMA_CODE" } },
      ]),
    );
    expect(msg).not.toContain("P2002");
    expect(msg).not.toContain("tokenHash");
    expect(msg).toBe("The Feedock API rejected the request.");
  });

  it("maps a 404 transport status to the not-found hint", () => {
    const err = clientError([], 404);
    // No GraphQL message → falls through to the status hint.
    expect(apiErrorMessage(err)).toMatch(/not found/i);
  });

  it("maps a 429 transport status to the rate-limit hint", () => {
    expect(apiErrorMessage(clientError([], 429))).toMatch(/rate limit/i);
  });

  it("maps a 5xx transport status to the generic retry hint", () => {
    expect(apiErrorMessage(clientError([], 503))).toMatch(/internal error/i);
  });

  it("maps a network/fetch failure to the connectivity hint", () => {
    const msg = apiErrorMessage(new Error("fetch failed"));
    expect(msg).toMatch(/could not reach the feedock api/i);
  });

  it("never echoes a raw unknown error (no stack / internals leak)", () => {
    const secret = "postgres://user:s3cr3t@db:5432 SELECT * FROM tokens";
    const msg = apiErrorMessage(new Error(secret));
    expect(msg).not.toContain("s3cr3t");
    expect(msg).not.toContain("postgres://");
    expect(msg).not.toContain("SELECT");
    expect(msg).toBe(
      "An unexpected error occurred talking to the Feedock API.",
    );
  });

  it("bounds a verbose server message to a single line (no smuggled internals)", () => {
    const verbose =
      "line one\n  stack at foo.ts:12\n  at bar.ts:34\n" + "x".repeat(500);
    const msg = apiErrorMessage(
      clientError([
        { message: verbose, extensions: { code: "BAD_USER_INPUT" } },
      ]),
    );
    expect(msg).not.toContain("\n");
    expect(msg.length).toBeLessThanOrEqual(240);
  });
});

describe("toApiToolError", () => {
  it("wraps any thrown value into the safe isError result, no structuredContent", () => {
    const result = toApiToolError(
      clientError([{ message: "x", extensions: { code: "NOT_FOUND" } }]),
    );
    expect(result.isError).toBe(true);
    expect(result.content[0]?.type).toBe("text");
    expect("structuredContent" in result).toBe(false);
  });
});
