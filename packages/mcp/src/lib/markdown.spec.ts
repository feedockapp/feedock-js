/**
 * The MCP's markdown wrappers delegate to the shared `@feedock/sanitize`
 * implementation (which owns the full conversion suite — see
 * `packages/sanitize/src/markdown.spec.ts`). This is a thin parity check that
 * the published package's re-export path still converts markdown, passes
 * round-tripped HTML through unchanged, and never lets HTML smuggled through
 * markdown survive.
 */

import { describe, expect, it } from "vitest";

import { markdownToHtml, toRichTextHtml } from "./markdown.js";

describe("markdown wrappers — parity with @feedock/sanitize", () => {
  it("converts markdown blocks + inline", () => {
    expect(markdownToHtml("## Summary")).toBe("<h2>Summary</h2>");
    expect(markdownToHtml("use `**literal**` here")).toBe(
      "<p>use <code>**literal**</code> here</p>",
    );
  });

  it("routes markdown vs round-tripped HTML through toRichTextHtml", () => {
    expect(toRichTextHtml("## Hi")).toBe("<h2>Hi</h2>");
    expect(toRichTextHtml("<p>already <strong>html</strong></p>")).toBe(
      "<p>already <strong>html</strong></p>",
    );
  });

  it("never lets HTML smuggled through markdown survive", () => {
    const html = markdownToHtml("Hi\n\n<script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
