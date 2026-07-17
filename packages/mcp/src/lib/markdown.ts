/**
 * Markdown → the rich-text HTML the product stores and renders.
 *
 * Models write markdown; every Feedock rich-text surface (task descriptions,
 * doc bodies, changelog bodies) stores **HTML** — the TipTap editor's `value`
 * is HTML, and the read path renders it through `<RichText>`. Sending raw
 * markdown through a write tool therefore persisted `## Summary` and
 * ```` ```ts ```` as literal characters, which is what a founder saw in the
 * dashboard: a wall of unstyled text with visible hashes and backticks.
 *
 * This is deliberately a **small, dependency-free** converter, not a CommonMark
 * engine: it covers exactly what the shared sanitizer's allow-list can carry
 * (headings, bold/italic/strikethrough, inline code, fenced code, links,
 * bullet/ordered lists, blockquotes, rules, paragraphs) and everything else
 * degrades to a paragraph. Adding `marked` for the long tail would ship a
 * parser into a published CLI to gain footnotes and tables the sanitizer would
 * strip anyway.
 *
 * SAFETY: the output goes through the shared `sanitizeRichText` allow-list
 * before it is returned, so raw HTML embedded in the markdown (`<script>`,
 * `onerror=`, `javascript:` hrefs) cannot survive. The conversion never trusts
 * its input; it escapes every text span it emits.
 */

import { sanitizeRichText } from "./sanitize.js";

/** Escape the four characters that could otherwise open a tag or attribute. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Inline spans, innermost-first so a code span's contents are never re-parsed
 * as emphasis. Everything is escaped before any tag is introduced.
 *
 * Code spans are parked behind a per-call RANDOM placeholder: a fixed token
 * could appear in the author's own prose and be swallowed on restore (verified
 * — a literal "&&CODE0&&" in the text vanished). The nonce makes the
 * placeholder unguessable and per-call unique, so no input can forge one.
 */
function inline(text: string): string {
  const codes: string[] = [];
  const nonce = Math.random().toString(36).slice(2, 10);
  const park = (i: number) => `\u0000${nonce}:${i}\u0000`;

  // Park code spans first: their contents are literal, never markdown.
  const parked = text.replace(/`([^`\n]+)`/g, (_m, code: string) => {
    codes.push(`<code>${escapeHtml(code)}</code>`);
    return park(codes.length - 1);
  });

  let html = escapeHtml(parked)
    // Links: only http/https/mailto survive the sanitizer anyway, but keep the
    // pattern tight so a `javascript:` href never reaches it as an <a> at all.
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g,
      '<a href="$2">$1</a>',
    )
    .replace(/\*\*\*([^*\n]+)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/~~([^~\n]+)~~/g, "<s>$1</s>");

  // Restore the parked code spans.
  for (let i = 0; i < codes.length; i += 1) {
    html = html.split(park(i)).join(codes[i] ?? "");
  }
  return html;
}

/** One list item's text, minus its marker. */
const BULLET = /^\s*[-*+]\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^(#{1,4})\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
const RULE = /^\s*(?:---+|\*\*\*+|___+)\s*$/;
const FENCE = /^\s*```(\w*)\s*$/;

/**
 * Convert a markdown document to sanitized rich-text HTML.
 *
 * Empty/whitespace input returns "" so a caller can treat it as "no body".
 */
export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let paragraph: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  let quote: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      out.push(`<p>${inline(paragraph.join("\n")).replace(/\n/g, "<br>")}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      const items = list.items
        .map((item) => `<li>${inline(item)}</li>`)
        .join("");
      out.push(`<${list.type}>${items}</${list.type}>`);
      list = null;
    }
  };
  const flushQuote = () => {
    if (quote.length > 0) {
      out.push(`<blockquote><p>${inline(quote.join(" "))}</p></blockquote>`);
      quote = [];
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";

    // Fenced code: consume verbatim to the closing fence (or EOF). Its content
    // is literal — no inline parsing, no markdown, just escaped text.
    const fence = FENCE.exec(line);
    if (fence) {
      flushAll();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !FENCE.test(lines[i] ?? "")) {
        body.push(lines[i] ?? "");
        i += 1;
      }
      out.push(`<pre><code>${escapeHtml(body.join("\n"))}</code></pre>`);
      continue;
    }

    if (line.trim() === "") {
      flushAll();
      continue;
    }

    if (RULE.test(line)) {
      flushAll();
      out.push("<hr>");
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flushAll();
      const level = heading[1]?.length ?? 1;
      out.push(`<h${level}>${inline(heading[2] ?? "")}</h${level}>`);
      continue;
    }

    const quoted = QUOTE.exec(line);
    if (quoted) {
      flushParagraph();
      flushList();
      quote.push(quoted[1] ?? "");
      continue;
    }

    const bullet = BULLET.exec(line);
    const ordered = ORDERED.exec(line);
    if (bullet || ordered) {
      flushParagraph();
      flushQuote();
      const type = bullet ? "ul" : "ol";
      const text = (bullet ? bullet[1] : ordered?.[1]) ?? "";
      if (list && list.type !== type) {
        flushList();
      }
      list ??= { type, items: [] };
      list.items.push(text);
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(line);
  }
  flushAll();

  // The allow-list is the last word: any HTML the markdown carried inline is
  // filtered here, never trusted.
  return sanitizeRichText(out.join(""));
}

/**
 * Normalize a rich-text body a tool received. Models write markdown; a caller
 * that already sends HTML (or an app round-tripping a body we returned) is
 * passed through the sanitizer unchanged, so both shapes are safe and neither
 * is double-converted.
 *
 * Deciding which is which used to be "does it contain any HTML tag?", which
 * mis-routed two real inputs onto the board as raw text (literal `##` headings
 * and backticked spans):
 *   1. Markdown a caller pre-wrapped in a single `<p>…</p>`.
 *   2. Markdown that merely *mentions* a tag in its prose (a bug report whose
 *      body talks about `<p>`), which the tag test can't tell from real HTML.
 * So: peel off a *lone* outer paragraph first (case 1 — the genuine rich HTML we
 * return is multi-block, never one `<p>` around everything), then pass a body to
 * the sanitizer ONLY when it carries HTML tags AND opens no markdown headings.
 * A heading-led body is markdown a caller wrote, tag mentions and all, so it is
 * converted (case 2). The sanitizer still runs on the ORIGINAL body, so genuine
 * round-tripped HTML is untouched.
 */
export function toRichTextHtml(body: string): string {
  const inner = unwrapLoneParagraph(body);
  return looksLikeHtml(inner) && !hasMarkdownHeading(inner)
    ? sanitizeRichText(body)
    : markdownToHtml(inner);
}

/** A body that already carries block-level HTML needs no markdown conversion. */
function looksLikeHtml(body: string): boolean {
  return /<(p|h[1-4]|ul|ol|li|pre|blockquote|strong|em|code|br|hr|a)\b[^>]*>/i.test(
    body,
  );
}

/**
 * An ATX heading at the start of any line — the clearest tell that a body is
 * markdown source. The HTML we return emits `<h2>` etc., never a literal
 * line-start `## `, so this fires only on markdown a caller wrote. Kept to
 * headings (not lists/fences) so a `#` inside a round-tripped `<pre>` block
 * can't be mistaken for one.
 */
function hasMarkdownHeading(body: string): boolean {
  return /(^|\n)[ \t]{0,3}#{1,6}[ \t]/.test(body);
}

/**
 * If the whole body is a single `<p>…</p>` (the common mis-wrap), return its
 * inner content; otherwise return the body unchanged. A real multi-paragraph
 * body ends past the first `</p>`, so it never matches — and even a wrapper
 * around more HTML is caught by {@link looksLikeHtml} on the inner content.
 */
function unwrapLoneParagraph(body: string): string {
  const match = /^\s*<p\b[^>]*>([\s\S]*)<\/p>\s*$/i.exec(body);
  return match ? (match[1] ?? "") : body;
}
