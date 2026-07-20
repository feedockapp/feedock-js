import { describe, expect, it } from "vitest";

import { plainTextToHtml, sanitizeRichText } from "./index";

/**
 * `plainTextToHtml` is the correct writer for a plain-text source that will be
 * stored + rendered as rich text (a Slack-sourced Feedback body). The wrong
 * writer — `sanitizeRichText` — treats the text AS HTML and destroys it.
 */
describe("plainTextToHtml", () => {
  it("keeps a tag-like token as literal text (sanitizeRichText would drop it)", () => {
    const src = "Login breaks when the <select> is empty";
    expect(plainTextToHtml(src)).toBe(
      "<p>Login breaks when the &lt;select&gt; is empty</p>",
    );
    // The bug: the sanitizer eats the tag.
    expect(String(sanitizeRichText(src))).not.toContain("select");
  });

  it("splits blank-line blocks into paragraphs, single newlines into <br>", () => {
    expect(plainTextToHtml("first line\nsame para\n\nsecond para")).toBe(
      "<p>first line<br>same para</p><p>second para</p>",
    );
  });

  it("escapes all five HTML-significant characters", () => {
    expect(plainTextToHtml(`a & b < c > d " e ' f`)).toBe(
      `<p>a &amp; b &lt; c &gt; d &quot; e &#39; f</p>`,
    );
  });

  it("is a no-op through the rich-text sanitizer (output is already safe)", () => {
    const out = plainTextToHtml("one\n\ntwo <b>not bold</b>");
    expect(String(sanitizeRichText(out))).toBe(out);
  });

  it("returns empty for blank / whitespace-only input", () => {
    expect(plainTextToHtml("")).toBe("");
    expect(plainTextToHtml("   \n  ")).toBe("");
    expect(plainTextToHtml(null)).toBe("");
  });
});
