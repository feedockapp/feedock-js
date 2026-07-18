/**
 * Markdown → the rich-text HTML the product stores and renders.
 *
 * The converter itself lives in the shared **`@feedock/sanitize`** package (next
 * to the allow-list it targets), so the MCP write tools and the API's GitHub
 * Release → changelog ingestion share ONE implementation and can't drift. The
 * publish build **bundles** that code in (esbuild, `build.mjs`), so the published
 * package carries no `workspace:*` dependency.
 *
 * These are locally-typed wrappers (explicit `string` returns) so the emitted
 * `.d.ts` references only this package — never `@feedock/sanitize`, which isn't
 * published. The runtime behaviour is 100% `@feedock/sanitize`.
 */
import {
  markdownToHtml as markdownToHtmlImpl,
  toRichTextHtml as toRichTextHtmlImpl,
} from "@feedock/sanitize";

/** Convert a markdown document to sanitized rich-text HTML. */
export function markdownToHtml(markdown: string): string {
  return markdownToHtmlImpl(markdown);
}

/**
 * Normalize a rich-text body a tool received: markdown is converted, HTML the
 * caller already sent is passed through the sanitizer unchanged (never double-
 * converted). See the shared implementation for the routing rationale.
 */
export function toRichTextHtml(body: string): string {
  return toRichTextHtmlImpl(body);
}
