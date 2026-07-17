/**
 * Test harness for the tool layer (test-only — never imported by `cli.ts`/the
 * shipped server). Two pieces every spec reuses:
 *
 *  1. {@link createCaptureServer} — a fake `McpServer` that records every
 *     `registerTool(name, config, handler)` call so a test can assert the
 *     registered metadata (annotations, schemas) and invoke a handler directly,
 *     without standing up a real transport.
 *  2. {@link createMockClient} — a {@link FeedockClient} whose `request` is a
 *     queue of canned responses keyed by call order (or a function), so a mapper
 *     test can feed malicious HTML in and assert the sanitized output back.
 *
 * The capture server is intentionally structural: it implements only the surface
 * the tool modules touch (`registerTool`), cast to `McpServer` at the boundary.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  CallToolResult,
  ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";
import { vi } from "vitest";

import type { FeedockClient } from "./client/feedock-client.js";

/** What `registerTool` hands us, captured verbatim for assertions. */
export interface CapturedTool {
  name: string;
  title?: string;
  description?: string;
  /** Raw zod shape object the SDK wraps (or undefined for no-input tools). */
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  annotations?: ToolAnnotations;
  /** Invoke the tool's handler with validated args; returns the tool result. */
  run: (args: Record<string, unknown>) => Promise<CallToolResult>;
}

export interface CaptureServer {
  server: McpServer;
  tools: Map<string, CapturedTool>;
  /** Convenience: the captured tool by name (throws if not registered). */
  get(name: string): CapturedTool;
}

type ToolConfig = {
  title?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  annotations?: ToolAnnotations;
};
type ToolHandler = (
  args: Record<string, unknown>,
  extra?: unknown,
) => CallToolResult | Promise<CallToolResult>;

/**
 * Build a fake `McpServer` that captures `registerTool` calls. Pass it straight
 * to any `registerXxxTools(server, ctx)`.
 */
export function createCaptureServer(): CaptureServer {
  const tools = new Map<string, CapturedTool>();

  const registerTool = (
    name: string,
    config: ToolConfig,
    handler: ToolHandler,
  ): unknown => {
    tools.set(name, {
      name,
      title: config.title,
      description: config.description,
      inputSchema: config.inputSchema,
      outputSchema: config.outputSchema,
      annotations: config.annotations,
      run: async (args) => handler(args, {}),
    });
    // The real SDK returns a RegisteredTool handle; tool modules ignore it.
    return { enabled: true };
  };

  const fake = { registerTool } as unknown as McpServer;

  return {
    server: fake,
    tools,
    get(name) {
      const t = tools.get(name);
      if (!t) {
        throw new Error(`tool not registered: ${name}`);
      }
      return t;
    },
  };
}

/**
 * A {@link FeedockClient} mock. Pass either an ordered list of responses (each
 * `request` call shifts the next one) or a function `(document, variables) =>
 * data`. A response may be an `Error` instance, in which case `request` rejects
 * with it (to exercise the error-mapping path).
 */
export function createMockClient(
  responses: unknown[] | ((document: string, variables?: unknown) => unknown),
): FeedockClient & { calls: { document: string; variables?: unknown }[] } {
  const calls: { document: string; variables?: unknown }[] = [];
  const queue = Array.isArray(responses) ? [...responses] : null;

  const request = vi.fn(
    async (document: string, variables?: unknown): Promise<unknown> => {
      calls.push({ document, variables });
      const value =
        queue !== null
          ? queue.shift()
          : (responses as (d: string, v?: unknown) => unknown)(
              document,
              variables,
            );
      if (value instanceof Error) {
        throw value;
      }
      return value;
    },
  );

  return {
    request: request as FeedockClient["request"],
    calls,
  };
}

/**
 * Parse a tool result's text content back into an object. Mirrors what an MCP
 * client does with the JSON text block; lets a test assert text + structured
 * stay in lockstep.
 */
export function parseResultText(result: CallToolResult): unknown {
  const first = result.content?.[0];
  if (!first || first.type !== "text") {
    throw new Error("expected a text content block");
  }
  return JSON.parse(first.text);
}

/** The malicious HTML fixtures every sanitize-on-output test feeds in. */
export const XSS_PAYLOAD =
  "<p>Hello</p><script>alert(1)</script>" +
  '<img src=x onerror="alert(2)">' +
  '<a href="javascript:alert(3)">click</a>';

/**
 * Assert a string is free of the XSS vectors `@feedock/sanitize` strips:
 * `<script>`, inline event handlers, and `javascript:` URLs.
 */
export function expectNoXss(value: string): void {
  const lower = value.toLowerCase();
  if (lower.includes("<script")) {
    throw new Error(`<script> survived: ${value}`);
  }
  if (lower.includes("onerror")) {
    throw new Error(`onerror survived: ${value}`);
  }
  if (lower.includes("javascript:")) {
    throw new Error(`javascript: survived: ${value}`);
  }
}
