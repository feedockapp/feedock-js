import type { ResolvedTheme } from "../theme";

/**
 * The recessed surface fill shared by the panel's bordered components — feedback
 * cards, the search field, the sort control — a shade below the panel bg so they
 * read as one consistent surface family. (theme.card stays the *lifted* color:
 * the active sort pill.)
 */
export function surfaceBg(theme: ResolvedTheme): string {
  return theme.mode === "dark" ? "#0E1112" : "#F3F4F6";
}

/** Primary text (titles + counts) — a softened white (80%) on dark, ink on light. */
export function primaryText(theme: ResolvedTheme): string {
  return theme.mode === "dark" ? "rgba(255,255,255,0.8)" : theme.text;
}

/** Secondary text (excerpts, meta, status labels) — neutral gray / muted token. */
export function secondaryText(theme: ResolvedTheme): string {
  return theme.mode === "dark" ? "#969696" : theme.muted;
}

/**
 * The one component border, shared by every bordered surface so they match — a
 * dim hairline, brightened a touch on hover. Kept intentionally low-contrast.
 */
export function surfaceBorder(theme: ResolvedTheme, hover = false): string {
  const dark = theme.mode === "dark";
  if (hover) {
    return dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)";
  }
  return dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)";
}
