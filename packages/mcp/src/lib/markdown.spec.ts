/**
 * The markdown → rich-text-HTML bridge. Models write markdown; every Feedock
 * rich-text surface stores HTML, so a tool that persisted the raw string put
 * literal `##` and backticks on the founder's board (the bug this fixes).
 *
 * The last assertion block is the important one: conversion NEVER trusts its
 * input — the shared allow-list runs last, so HTML smuggled through markdown
 * cannot survive.
 */

import { describe, expect, it } from "vitest";

import { markdownToHtml, toRichTextHtml } from "./markdown.js";

describe("markdownToHtml — blocks", () => {
  it("converts headings", () => {
    expect(markdownToHtml("## Summary")).toBe("<h2>Summary</h2>");
    expect(markdownToHtml("#### Deep")).toBe("<h4>Deep</h4>");
  });

  it("converts a fenced code block, keeping its contents literal", () => {
    const md = "```ts\nconst a = 1 < 2 && b > c;\n```";
    expect(markdownToHtml(md)).toBe(
      "<pre><code>const a = 1 &lt; 2 &amp;&amp; b &gt; c;</code></pre>",
    );
  });

  it("does not parse markdown inside a code fence", () => {
    const md = "```\n**not bold** and `not code`\n```";
    expect(markdownToHtml(md)).toBe(
      "<pre><code>**not bold** and `not code`</code></pre>",
    );
  });

  it("converts bullet and ordered lists", () => {
    expect(markdownToHtml("- one\n- two")).toBe(
      "<ul><li>one</li><li>two</li></ul>",
    );
    expect(markdownToHtml("1. one\n2. two")).toBe(
      "<ol><li>one</li><li>two</li></ol>",
    );
  });

  it("splits paragraphs on blank lines and keeps single newlines as breaks", () => {
    // sanitize-html normalizes void elements to their self-closed form.
    expect(markdownToHtml("one\ntwo\n\nthree")).toBe(
      "<p>one<br />two</p><p>three</p>",
    );
  });

  it("converts blockquotes and rules", () => {
    expect(markdownToHtml("> quoted")).toBe(
      "<blockquote><p>quoted</p></blockquote>",
    );
    expect(markdownToHtml("---")).toBe("<hr />");
  });

  it("returns empty for an empty body", () => {
    expect(markdownToHtml("")).toBe("");
    expect(markdownToHtml("   \n  ")).toBe("");
  });
});

describe("markdownToHtml — inline", () => {
  it("converts bold, italic, bold-italic, strikethrough", () => {
    expect(markdownToHtml("**b**")).toBe("<p><strong>b</strong></p>");
    expect(markdownToHtml("*i*")).toBe("<p><em>i</em></p>");
    expect(markdownToHtml("***bi***")).toBe(
      "<p><strong><em>bi</em></strong></p>",
    );
    expect(markdownToHtml("~~s~~")).toBe("<p><s>s</s></p>");
  });

  it("converts inline code without re-parsing its contents", () => {
    expect(markdownToHtml("use `**literal**` here")).toBe(
      "<p>use <code>**literal**</code> here</p>",
    );
  });

  // Code spans are parked behind a placeholder while the rest is parsed. A
  // guessable token could be forged (or collide with) the author's own prose
  // and vanish on restore — both cases regressed a fixed token in review.
  it("keeps prose digits beside a code span", () => {
    expect(markdownToHtml("call `fn()` 1 2 3 times")).toBe(
      "<p>call <code>fn()</code> 1 2 3 times</p>",
    );
  });

  it("cannot have its code-span placeholder forged by the author's text", () => {
    expect(markdownToHtml("literal &&CODE0&& text")).toBe(
      "<p>literal &amp;&amp;CODE0&amp;&amp; text</p>",
    );
  });

  it("converts http/mailto links and hardens them", () => {
    const html = markdownToHtml("[docs](https://feedock.com/docs)");
    expect(html).toContain('href="https://feedock.com/docs"');
    // The shared sanitizer forces safe link attrs.
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });
});

describe("markdownToHtml — never trusts its input", () => {
  // Escape-first: raw HTML in markdown never BECOMES markup, so it reaches the
  // sanitizer as text and renders as visible characters. Stronger than
  // stripping — there is no parse step for an attacker to aim at.
  it("neutralizes a script tag into inert text", () => {
    const html = markdownToHtml("Hi\n\n<script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("neutralizes an onerror handler into inert text", () => {
    const html = markdownToHtml('<img src=x onerror="alert(1)">');
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("does not emit an <a> for a javascript: link", () => {
    const html = markdownToHtml("[x](javascript:alert(1))");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("href");
  });

  it("escapes angle brackets in prose", () => {
    expect(markdownToHtml("a < b and c > d")).toBe(
      "<p>a &lt; b and c &gt; d</p>",
    );
  });
});

describe("toRichTextHtml", () => {
  it("converts markdown", () => {
    expect(toRichTextHtml("## Hi")).toBe("<h2>Hi</h2>");
  });

  // A caller round-tripping a body we returned must not have it double-escaped.
  it("passes existing HTML through the sanitizer instead of re-converting", () => {
    expect(toRichTextHtml("<p>already <strong>html</strong></p>")).toBe(
      "<p>already <strong>html</strong></p>",
    );
  });

  it("still sanitizes HTML input", () => {
    expect(toRichTextHtml("<p>ok</p><script>alert(1)</script>")).toBe(
      "<p>ok</p>",
    );
  });

  // The bug: a caller that pre-wrapped its markdown in one <p> used to hit the
  // passthrough branch, so `##`/backticks landed on the board as literal text.
  // A lone wrapping <p> is now peeled off and the markdown inside is converted.
  it("converts markdown a caller wrapped in a single outer <p>", () => {
    expect(
      toRichTextHtml("<p>## Summary\n\nBody with `code`.</p>"),
    ).toBe("<h2>Summary</h2><p>Body with <code>code</code>.</p>");
  });

  it("converts a lone-<p>-wrapped heading (the reported shape)", () => {
    expect(toRichTextHtml("<p>## Summary of the bug</p>")).toBe(
      "<h2>Summary of the bug</h2>",
    );
  });

  // Peeling the wrapper must NOT re-convert genuine round-tripped HTML: a lone
  // <p> that carries real inline tags is still passed through untouched, because
  // the inner content still looks like HTML and the ORIGINAL body is sanitized.
  it("still passes a lone <p> with real inline HTML through unchanged", () => {
    expect(toRichTextHtml("<p>plain <strong>bold</strong> text</p>")).toBe(
      "<p>plain <strong>bold</strong> text</p>",
    );
  });

  it("still passes multi-block HTML through unchanged", () => {
    expect(toRichTextHtml("<h2>Title</h2><p>body</p>")).toBe(
      "<h2>Title</h2><p>body</p>",
    );
  });

  // The subtler variant: a heading-led markdown body that MENTIONS a tag in its
  // prose (e.g. a bug report about `<p>`) used to trip the tag test and pass
  // through raw. A leading `##` marks it as markdown — convert it, tag and all.
  it("converts heading-led markdown that only mentions a tag mid-body", () => {
    const html = toRichTextHtml("## Title\n\nWrap it in `<p>` to break.");
    expect(html).toBe(
      "<h2>Title</h2><p>Wrap it in <code>&lt;p&gt;</code> to break.</p>",
    );
  });
});
