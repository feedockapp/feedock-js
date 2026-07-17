/**
 * Inline syntax-highlight theme for the SDK.
 *
 * Code bodies arrive from the public API ALREADY highlighted — inert
 * `<span class="hljs-…">` tokens (the server tokenizes once; see the API's
 * highlightRichText). The SDK is deliberately stylesheet-free (inline styles
 * only, so it can't pollute an embedder's page), so we colour those existing
 * spans by setting inline `style.color` from a small palette — there is NO
 * highlight.js engine in the SDK, just a lookup + a walk over the few spans a
 * code block contains. One Light on light mode, One Dark on dark.
 */

import type { ResolvedTheme } from "../../theme";

const MONO =
  "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

type Palette = Record<string, string>;

const LIGHT: Palette = {
  "hljs-comment": "#8a8f98",
  "hljs-quote": "#8a8f98",
  "hljs-keyword": "#a626a4",
  "hljs-selector-tag": "#a626a4",
  "hljs-string": "#50a14f",
  "hljs-regexp": "#50a14f",
  "hljs-number": "#986801",
  "hljs-literal": "#986801",
  "hljs-title": "#4078f2",
  "hljs-section": "#4078f2",
  "hljs-built_in": "#c18401",
  "hljs-type": "#c18401",
  "hljs-class": "#c18401",
  "hljs-attr": "#986801",
  "hljs-attribute": "#986801",
  "hljs-tag": "#e45649",
  "hljs-name": "#e45649",
  "hljs-variable": "#e45649",
  "hljs-meta": "#0184bc",
  "hljs-symbol": "#0184bc",
  "hljs-deletion": "#e45649",
  "hljs-addition": "#50a14f",
};

const DARK: Palette = {
  "hljs-comment": "#6b7280",
  "hljs-quote": "#6b7280",
  "hljs-keyword": "#c678dd",
  "hljs-selector-tag": "#c678dd",
  "hljs-string": "#98c379",
  "hljs-regexp": "#98c379",
  "hljs-number": "#d19a66",
  "hljs-literal": "#d19a66",
  "hljs-title": "#61afef",
  "hljs-section": "#61afef",
  "hljs-built_in": "#e5c07b",
  "hljs-type": "#e5c07b",
  "hljs-class": "#e5c07b",
  "hljs-attr": "#d19a66",
  "hljs-attribute": "#d19a66",
  "hljs-tag": "#e06c75",
  "hljs-name": "#e06c75",
  "hljs-variable": "#e06c75",
  "hljs-meta": "#56b6c2",
  "hljs-symbol": "#56b6c2",
  "hljs-deletion": "#e06c75",
  "hljs-addition": "#98c379",
};

/**
 * Style the code blocks under `root` inline: a translucent surface + monospace
 * on each `pre`/`code`, and a token colour on every `hljs-*` span. Idempotent
 * and cheap (only touches code — a no-op for prose bodies). Runs after the SDK's
 * SafeHtml sets its inner HTML, so the API's spans exist to be coloured.
 */
export function colorizeCodeBlocks(
  root: HTMLElement,
  theme: ResolvedTheme,
): void {
  // A translucent gray reads on any panel bg (matches the widget's shadow-root
  // rule, so the widget — which also renders through this SafeHtml — stays
  // consistent whether the CSS or this inline pass wins).
  const surface = "rgba(127,127,127,0.14)";
  root.querySelectorAll("pre").forEach((pre) => {
    Object.assign(pre.style, {
      margin: "8px 0",
      padding: "10px 12px",
      borderRadius: "8px",
      background: surface,
      overflowX: "auto",
    });
    const code = pre.querySelector("code");
    if (code) {
      Object.assign(code.style, {
        display: "block",
        fontFamily: MONO,
        fontSize: "0.82em",
        lineHeight: "1.5",
        whiteSpace: "pre",
        background: "none",
        padding: "0",
      });
    }
  });
  const palette = theme.mode === "dark" ? DARK : LIGHT;
  root.querySelectorAll<HTMLElement>('pre code span[class*="hljs-"]').forEach(
    (span) => {
      // Compound scopes exist (e.g. "hljs-title function_") — take the first
      // class we have a colour for.
      for (const cls of span.classList) {
        const color = palette[cls];
        if (color) {
          span.style.color = color;
          break;
        }
      }
    },
  );
}
