/**
 * Escape a plain-text comment for the optimistic (pre-refetch) render: the
 * comment API takes plain text, but the detail renders comment bodies as HTML
 * (the server escapes them on the way back out), so the local echo has to be
 * escaped here or a body containing markup would render as markup.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
