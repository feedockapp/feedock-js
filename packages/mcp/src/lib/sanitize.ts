/**
 * OUTPUT sanitization for the tool mappers — no re-implementation of the
 * allow-list (docs/features/mcp-server.md §4 + §6 rule 3). The actual sanitizer
 * (and its allow-list) is the shared `@feedock/sanitize`; the runtime delegates
 * to it directly, and the publish build **bundles** that code in (esbuild,
 * `build.mjs`) so the published package carries no `workspace:*` dependency.
 *
 * The functions are re-exported through locally-typed wrappers (with a local
 * {@link SafeHtml} brand) so the **emitted `.d.ts` references only this package**
 * — never `@feedock/sanitize`, which isn't published. The runtime behaviour is
 * 100% `@feedock/sanitize`; only the type brand is mirrored here.
 *
 * Mappers sanitize rich-text fields here, in the projection step, **before**
 * building `structuredContent` (the SDK discards transformed output, so
 * sanitizing in a schema `.transform` would ship raw HTML — §5.3).
 */
import {
  sanitizeDocHtml as sanitizeDocHtmlImpl,
  sanitizeRichText as sanitizeRichTextImpl,
} from "@feedock/sanitize";

/**
 * Branded string proven safe to inject as HTML. Mirrors `@feedock/sanitize`'s
 * brand locally so the published types are self-contained; the brand erases
 * across the JSON boundary (it's just a `string` at runtime).
 */
export type SafeHtml = string & { readonly __safeHtml: unique symbol };

/** Sanitize a rich-text HTML body for model/output rendering (strict allow-list). */
export function sanitizeRichText(html: string | null | undefined): SafeHtml {
  return sanitizeRichTextImpl(html) as unknown as SafeHtml;
}

/** Sanitize a trusted Doc/Spec body (checklist-aware allow-list) for output. */
export function sanitizeDocHtml(html: string | null | undefined): SafeHtml {
  return sanitizeDocHtmlImpl(html) as unknown as SafeHtml;
}
