import sanitizeHtml from "sanitize-html";

/**
 * Server-side HTML sanitizer for rich-text bodies (Feedback, Roadmap,
 * Changelog, Doc) before they are returned by any PUBLIC / SSR-rendered
 * surface — or handed to an LLM / downstream UI via the MCP server.
 *
 * Rich-text is authored with TipTap and stored as HTML. In the authenticated
 * dashboard it is sanitized only in the browser (client-side DOMPurify). The
 * public read API, any server-rendered consumer, and the MCP tool layer cannot
 * rely on that, so we sanitize here with an allow-list that mirrors the
 * editor's output — a low-trust author's content must never become stored XSS
 * on a public page (or be passed verbatim to a model).
 *
 * This package is the single shared allow-list so `apps/api` and `@feedock/mcp`
 * can't drift. See docs/features/mcp-server.md §6 and
 * docs/features/public-portal.md §"Anti-abuse & privacy".
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "strike",
    "code",
    "pre",
    "blockquote",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "a",
    "hr",
    "mark",
  ],
  // `target`/`rel` must be allowlisted for the transform below to survive —
  // sanitize-html applies the attribute allowlist AFTER transformTags, so
  // without them the forced-safe-link attrs were silently stripped again.
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
  },
  // Only safe link schemes; no javascript:/data: vectors.
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  // Force external links to open safely (no reverse-tabnabbing / referrer leak).
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      rel: "noopener noreferrer nofollow",
      target: "_blank",
    }),
  },
  // Strip disallowed tags entirely (drop their text too for <script>/<style>).
  disallowedTagsMode: "discard",
};

/**
 * Branded type for strings that are SAFE to inject as HTML (already sanitized or
 * entity-escaped). Only the sanitizers below produce it, and public read-model
 * HTML fields require it — so a future refactor literally cannot assign an
 * un-sanitized string to a public body/description (compile error, not a runtime
 * surprise). The brand is API-internal; it erases across the JSON boundary.
 */
export type SafeHtml = string & { readonly __safeHtml: unique symbol };

/** Sanitize a rich-text HTML body for public/server-side rendering. */
export function sanitizeRichText(html: string | null | undefined): SafeHtml {
  if (!html) {
    return "" as SafeHtml;
  }
  return sanitizeHtml(html, OPTIONS) as SafeHtml;
}

/**
 * Opening/closing tag from the {@link OPTIONS} rich-text set. `\b` after the tag
 * name keeps it precise: `<select>` / `<span>` / `<script>` do NOT match (`s`
 * isn't followed by a word boundary), so a body that merely mentions a tag-like
 * token is treated as plain text, not markup.
 */
const RICH_TAG =
  /<\/?(?:p|br|strong|b|em|i|u|s|strike|code|pre|blockquote|ul|ol|li|h[1-4]|a|hr|mark)\b/i;

/**
 * Heuristic: does this string look like editor-emitted rich text (TipTap HTML)
 * rather than plain text? Comment bodies share one column across two authoring
 * paths — a member's rich-text reply (`<p>…</p>`) and an account-less visitor's
 * plain text ("+1 from me", or literally "I want a `<select>`"). Rich bodies
 * should be sanitized-and-rendered as HTML; plain bodies must be entity-escaped
 * so their angle brackets survive verbatim. This tells the two apart.
 *
 * Mirrored (as `looksLikeRichText`) in @feedock/ui for the client-rendered
 * dashboard — this package pulls in `sanitize-html` (server-only), so it must
 * not enter the browser bundle. Keep the tag set in sync.
 */
export function looksLikeRichHtml(text: string | null | undefined): boolean {
  return !!text && RICH_TAG.test(text);
}

/** Escape the five HTML-significant characters in a run of plain text. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Convert PLAIN TEXT into safe rich-text HTML for a body stored + rendered as
 * rich text (Feedback/Doc bodies are HTML at rest). Escapes every character so a
 * tag-like token ("<select>") survives as literal text, splits blank-line-
 * separated blocks into `<p>`, and keeps single newlines as `<br>`. The output
 * is already within `sanitizeRichText`'s allow-list, so re-sanitizing it is a
 * no-op — this is the correct writer for a plain-text source (unlike
 * `sanitizeRichText`, which would DROP the tag-like tokens and the newlines).
 */
export function plainTextToHtml(text: string | null | undefined): SafeHtml {
  if (!text || !text.trim()) {
    return "" as SafeHtml;
  }
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`);
  return paragraphs.join("") as SafeHtml;
}

/**
 * The ONLY `<img src>` shape allowed in a doc body: the app's own attachment
 * download route with a UUID id — exactly what the editor's image-upload tool
 * inserts. No external http(s) images (an off-site URL is a tracking pixel /
 * IP-leak on a public page — same policy as the server-side avatar allowlist),
 * no `data:`/`javascript:` vectors, no path traversal (the UUID is anchored).
 */
const OWN_ATTACHMENT_SRC = /^\/api\/attachments\/[0-9a-fA-F-]{36}$/;

/**
 * Editor-persisted image presentation, mirrored from @feedock/ui's
 * lib/editor-image.ts (keep in sync): `data-align` is a closed enum and the
 * ONLY style property an image may carry is `width:NN%`. Everything else on
 * `style` stays banned (the attribute is still not allowed on any other tag),
 * so the "no inline CSS" security posture holds beyond this one shape.
 */
const IMAGE_ALIGN_VALUES = new Set(["left", "center", "right"]);
const IMAGE_WIDTH_STYLE = [/^\d{1,3}%$/];
/** Intrinsic aspect ratio (w/h) so the box reserves height before pixels load. */
const IMAGE_ASPECT_STYLE = [/^\d+(?:\.\d+)?$/];
/**
 * Table/column width, in px. TipTap writes the author's dragged column widths
 * into a `<colgroup>`, so without this a resized table renders as even columns
 * on read while the editor still shows the drag. Bounded to 4 digits — a plain
 * number, no url()/expression surface.
 */
const TABLE_WIDTH_STYLE = [/^\d{1,4}px$/];

/**
 * File-card metadata shapes, mirrored from @feedock/ui's lib/editor-media.ts
 * (keep in sync): the human size string rendered via CSS attr() and a plain
 * type/subtype MIME. Anything else is dropped from the card's data attrs.
 */
const FILE_SIZE_TEXT = /^\d+(?:\.\d+)? ?(?:B|KB|MB)$/;
const FILE_MIME_TEXT = /^[\w.+-]+\/[\w.+-]+$/;
const FILE_CARD_TYPE = "attachment-file";

/**
 * Doc-flavoured allow-list: the strict {@link OPTIONS} set plus the TipTap
 * **task-list** (checklist) block and **own-storage images**. Docs are authored
 * by trusted internal members (any active member) and so may use richer blocks
 * than the public, account-less feedback path — but the output is still rendered
 * on PUBLIC doc pages, so the allow-list stays XSS-safe.
 *
 * The checklist is kept as semantic markup only — `<ul data-type="taskList">` /
 * `<li data-type="taskItem" data-checked>` plus the content `<div>`. The native
 * `<label>/<input>` checkbox widget is intentionally **not** allowed: the read
 * renderers draw the box from `data-checked` via CSS, so no interactive form
 * control (or its event surface) ever reaches a public page.
 *
 * Inline media is allowed ONLY with an own-attachment URL ({@link
 * OWN_ATTACHMENT_SRC}): any other `<img>`/`<video>` is removed entirely, and an
 * `<a>` posing as a file card with a foreign href loses its card marker (stays a
 * plain link). The public doc mapper then rewrites those URLs to the public,
 * visibility-gated download proxy.
 */
const DOC_OPTIONS: sanitizeHtml.IOptions = {
  ...OPTIONS,
  allowedTags: [
    ...(OPTIONS.allowedTags as string[]),
    "div",
    "img",
    "video",
    // Tables. Structural elements only — no <caption>/<col>/<colgroup>, and the
    // cell attributes below are numeric span/width metadata, so a table carries
    // no scriptable surface. NOT in the public OPTIONS set: account-less
    // feedback bodies stay plain.
    "table",
    "colgroup",
    "col",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
  ],
  allowedAttributes: {
    ...OPTIONS.allowedAttributes,
    // The file card is a marked-up anchor (data-type="attachment-file" + display
    // metadata); the `a` transform below strips the marker unless the href is an
    // own-attachment URL, so a foreign link can never pose as a card.
    a: [
      "href",
      "title",
      "target",
      "rel",
      "data-type",
      "data-file-name",
      "data-file-size",
      "data-mime",
    ],
    ul: ["data-type"],
    li: ["data-type", "data-checked"],
    img: ["src", "alt", "data-align", "style"],
    video: ["src", "controls", "preload"],
    // TipTap writes colspan/rowspan and a colwidth list (column resizing).
    // `style` is deliberately NOT allowed here — width lives in `colwidth`, and
    // allowing style on cells would reopen a CSS-injection surface that the
    // img-only allowedStyles entry keeps narrow.
    th: ["colspan", "rowspan", "colwidth"],
    td: ["colspan", "rowspan", "colwidth"],
    // Column widths only — see TABLE_WIDTH_STYLE.
    table: ["style"],
    col: ["style"],
  },
  // `style` is allowed ONLY on img and ONLY as `width:NN%` (the width slider) +
  // `aspect-ratio:<number>` (reserve height before load); sanitize-html
  // re-serializes from this per-property allowlist, so url()/expression payloads
  // can't ride along.
  allowedStyles: {
    img: { width: IMAGE_WIDTH_STYLE, "aspect-ratio": IMAGE_ASPECT_STYLE },
    table: { "min-width": TABLE_WIDTH_STYLE },
    col: { "min-width": TABLE_WIDTH_STYLE, width: TABLE_WIDTH_STYLE },
  },
  transformTags: {
    ...OPTIONS.transformTags,
    // Keep the strict tier's safe-link forcing (rel/target) AND gate the
    // file-card marker: it survives only on an own-attachment href, with its
    // display metadata shape-checked (size/mime feed CSS attr() rendering).
    a: (tagName, attribs) => {
      const next: Record<string, string> = {
        ...attribs,
        rel: "noopener noreferrer nofollow",
        target: "_blank",
      };
      const isCard =
        next["data-type"] === FILE_CARD_TYPE &&
        OWN_ATTACHMENT_SRC.test(next["href"] ?? "");
      if (isCard) {
        if (!FILE_SIZE_TEXT.test(next["data-file-size"] ?? "")) {
          delete next["data-file-size"];
        }
        if (!FILE_MIME_TEXT.test(next["data-mime"] ?? "")) {
          delete next["data-mime"];
        }
      } else {
        delete next["data-type"];
        delete next["data-file-name"];
        delete next["data-file-size"];
        delete next["data-mime"];
      }
      return { tagName, attribs: next };
    },
    // Constrain data-align to the editor's enum (attribute allowlists in
    // sanitize-html are name-based, not value-based).
    img: (tagName, attribs) => {
      const align = attribs["data-align"];
      if (align !== undefined && !IMAGE_ALIGN_VALUES.has(align)) {
        delete attribs["data-align"];
      }
      return { tagName, attribs };
    },
    // Normalize the inline player to the editor's exact shape: controls on,
    // never auto-downloading — whatever attrs came in.
    video: (tagName, attribs) => ({
      tagName,
      attribs: {
        src: attribs["src"] ?? "",
        controls: "controls",
        preload: "metadata",
      },
    }),
  },
  // Drop any media element whose src is not the app's own attachment route.
  exclusiveFilter: (frame) =>
    (frame.tag === "img" || frame.tag === "video") &&
    !OWN_ATTACHMENT_SRC.test(frame.attribs["src"] ?? ""),
};

/** Sanitize a trusted Doc/Spec body (checklist-aware) for public rendering. */
export function sanitizeDocHtml(html: string | null | undefined): SafeHtml {
  if (!html) {
    return "" as SafeHtml;
  }
  return sanitizeHtml(html, DOC_OPTIONS) as SafeHtml;
}

/**
 * Redact high-confidence secrets + PII from user-authored text BEFORE it is sent
 * to any AI/embeddings vendor (privacy + secret-leak defense). End users type
 * feedback/doc bodies that can contain a pasted API key, token, private key, or
 * email — the prompt layer's type-level "PII-free" claim does not hold at the
 * DATA level, so scrub it here. Deliberately CONSERVATIVE: only unambiguous
 * secret/PII shapes are replaced, so triage/clustering/embedding quality is
 * preserved (no general-purpose NER that would strip legitimate product terms).
 *
 * Lives in the shared package so the API (LLM prompts + dedupe query) and the
 * worker (embed-on-write) apply the SAME redaction — the query vector and stored
 * vectors must be computed on identically-redacted text or NN search breaks.
 */
const REDACTIONS: ReadonlyArray<readonly [RegExp, string]> = [
  // Feedock's OWN PAT (`fdk_pat_<64 hex>` — apps/api/src/token/token.constants.ts).
  // Leads the list because it is the credential most likely to appear in Feedock's
  // own feedback: "my token fdk_pat_… returns 401" pasted straight into the board.
  // The prefix is the discriminator, so the length bound only has to separate a
  // real secret (64 hex) from the 6-hex DISPLAY prefix `fdk_pat_ab12cd` that the
  // UI shows on purpose — that one must survive, it is the handle a user names
  // their token by and triage needs it. 32 leaves room for a paste that lost a
  // character: most of a live secret is still a secret.
  [/\bfdk_pat_[0-9a-fA-F]{32,}\b/g, "[REDACTED_TOKEN]"],
  // PEM private key blocks (any type).
  [
    /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g,
    "[REDACTED_PRIVATE_KEY]",
  ],
  // JWTs (header.payload.signature).
  [
    /\bey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    "[REDACTED_JWT]",
  ],
  // AWS access key id.
  [/\bAKIA[0-9A-Z]{16}\b/g, "[REDACTED_AWS_KEY]"],
  // GitHub / GitLab / Slack tokens.
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, "[REDACTED_TOKEN]"],
  [/\bglpat-[A-Za-z0-9_-]{20,}\b/g, "[REDACTED_TOKEN]"],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, "[REDACTED_TOKEN]"],
  // Stripe / OpenAI-style secret keys — hyphen form (sk-…, pk-…, rk-…) and the
  // Stripe underscore form (sk_live_…, rk_test_…) the hyphen pattern misses.
  [/\b[sprk]k-[A-Za-z0-9_-]{16,}\b/g, "[REDACTED_API_KEY]"],
  [/\b[sprk]k_(?:live|test)_[A-Za-z0-9]{10,}\b/g, "[REDACTED_API_KEY]"],
  // DB / broker connection strings carrying INLINE credentials (scheme://user:pass@host).
  // A creds-free URL (redis://localhost:6379) is not matched — the user:pass@ is required.
  [
    /\b(?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis|rediss|amqp|amqps):\/\/[^\s/@:]+:[^\s/@]+@\S+/gi,
    "[REDACTED_CONNECTION_STRING]",
  ],
  // Authorization bearer values.
  [/\bBearer\s+[A-Za-z0-9._-]{16,}\b/gi, "Bearer [REDACTED]"],
  // Generic secret assignments: a credential-ish key followed by `:`/`=` and a
  // 6+ non-space value. Keep the key (context for triage), drop the value. The
  // key match tolerates an env-style prefix/suffix (DB_PASSWORD, SECRET_KEY_BASE)
  // — `\w*` around the keyword, since `_` is a word char so a bare `\b` misses
  // them — and an optional quote on either side of the separator so quoted JSON
  // (`"password": "…"`) is caught too. The value length + separator requirement
  // still avoids prose like "password field" or "the reset token is emailed".
  [
    /(\b\w*(?:password|passwd|secret|token|api[_-]?key|access[_-]?key)\w*["']?\s*[:=]\s*["']?)(\S{6,})/gi,
    "$1[REDACTED_SECRET]",
  ],
  // Email addresses (Unicode-aware: matches internationalized local parts + IDNs).
  [
    /[\p{L}\p{N}_.%+-]+@[\p{L}\p{N}.-]+\.\p{L}{2,}/gu,
    "[REDACTED_EMAIL]",
  ],
];

/** Scrub secrets + emails from user content bound for an AI/embeddings provider. */
export function redactForAi(text: string): string {
  return REDACTIONS.reduce(
    (acc, [pattern, repl]) => acc.replace(pattern, repl),
    text,
  );
}

// Markdown → sanitized rich-text HTML. Lives next to the allow-list it targets
// and is shared by the two markdown producers: the MCP write tools (models write
// markdown) and the GitHub Release → changelog ingestion (release notes are
// markdown). Re-exported last so its `sanitizeRichText` import resolves against
// the definitions above (both are call-time, so the module cycle is benign).
export { markdownToHtml, toRichTextHtml } from "./markdown";
