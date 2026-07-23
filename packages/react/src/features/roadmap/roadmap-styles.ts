import type { CSSProperties } from "react";

import type { ResolvedTheme } from "../../theme";
import { primaryText, secondaryText, surfaceBg, surfaceBorder } from "../../shared/lib/surface";
import { fs } from "../../type-scale";

/**
 * Inline-style map for the SDK roadmap — vertical status sections (Now / Next /
 * Later / Shipped), each a per-column glyph header + a timeline-connected item
 * list with hairline row dividers. Shares the widget's tokens (primary/secondary
 * text, hairline borders).
 */
export function roadmapStyles(theme: ResolvedTheme) {
  const dark = theme.mode === "dark";
  return {
    root: {
      background: theme.bg,
      color: theme.text,
      fontFamily:
        "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif",
      display: "flex",
      flexDirection: "column",
      gap: 26,
    } as CSSProperties,
    message: { fontSize: fs(13), color: secondaryText(theme) } as CSSProperties,

    /* ---- section (a column, stacked) ---- */
    column: { display: "flex", flexDirection: "column" } as CSSProperties,
    columnHead: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 14,
    } as CSSProperties,
    columnIcon: { display: "inline-flex", flexShrink: 0 } as CSSProperties,
    columnTitle: {
      fontSize: fs(14),
      fontWeight: 600,
      color: primaryText(theme),
    } as CSSProperties,
    count: {
      marginLeft: "auto",
      fontSize: fs(12),
      fontWeight: 600,
      color: secondaryText(theme),
    } as CSSProperties,

    /* ---- timeline item ---- */
    // Rail width == the 17px header glyph and gap == the header's, so the node
    // centers under the section icon and item text left-aligns with the title.
    itemRow: { display: "flex", gap: 8 } as CSSProperties,
    rail: {
      width: 17,
      flexShrink: 0,
      position: "relative",
      display: "flex",
      justifyContent: "center",
    } as CSSProperties,
    // border-box + no shrink: the ring's OUTER box is exactly 12x12, so it can't
    // be squeezed narrower than tall by the 12px rail (which made it an oval).
    node: (color: string) =>
      ({
        width: 12,
        height: 12,
        boxSizing: "border-box",
        flexShrink: 0,
        borderRadius: "50%",
        border: `1.5px solid ${color}`,
        background: theme.bg,
        marginTop: 2,
        zIndex: 1,
      }) as CSSProperties,
    // Thin connector in the column color, matching its nodes.
    line: (color: string) =>
      ({
        position: "absolute",
        top: 8,
        bottom: 0,
        left: "50%",
        width: 1,
        transform: "translateX(-50%)",
        background: color,
      }) as CSSProperties,
    // The item body is a button (opens the detail) — reset chrome, with the
    // shared solid hairline between items.
    itemContent: (isLast: boolean) =>
      ({
        flex: 1,
        minWidth: 0,
        display: "block",
        textAlign: "left",
        background: "transparent",
        border: "none",
        padding: 0,
        paddingBottom: 16,
        marginBottom: isLast ? 0 : 16,
        borderBottom: isLast ? "none" : `1px solid ${surfaceBorder(theme)}`,
        cursor: "pointer",
        fontFamily: "inherit",
        color: "inherit",
      }) as CSSProperties,
    titleRow: {
      display: "flex",
      alignItems: "flex-start",
      gap: 10,
    } as CSSProperties,
    // Brightens on hover (the shared color-brighten affordance).
    itemTitle: (hover = false) =>
      ({
        flex: 1,
        minWidth: 0,
        fontSize: fs(14),
        fontWeight: 400,
        color: hover ? theme.text : primaryText(theme),
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        transition: "color 0.12s ease",
      }) as CSSProperties,
    date: {
      flexShrink: 0,
      fontSize: fs(12.5),
      color: secondaryText(theme),
      whiteSpace: "nowrap",
    } as CSSProperties,
    description: {
      marginTop: 4,
      fontSize: fs(13),
      lineHeight: 1.45,
      color: secondaryText(theme),
      display: "-webkit-box",
      WebkitLineClamp: 2,
      WebkitBoxOrient: "vertical",
      overflow: "hidden",
    } as CSSProperties,
    pill: {
      display: "inline-flex",
      alignItems: "center",
      gap: 3,
      flexShrink: 0,
      padding: "3px 9px",
      borderRadius: 999,
      border: `1px solid ${surfaceBorder(theme)}`,
      fontSize: fs(12),
      color: primaryText(theme),
    } as CSSProperties,
    // The requester row (avatar + name) at the bottom of an item.
    authorRow: {
      marginTop: 8,
      display: "flex",
      alignItems: "center",
      gap: 6,
      fontSize: fs(12),
      color: secondaryText(theme),
      minWidth: 0,
    } as CSSProperties,
    authorName: {
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    } as CSSProperties,
    // "Show more ⌄" — brightens on hover, like the Home See-all links.
    showMore: (hover = false) =>
      ({
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        marginTop: 2,
        // Rail (17) + gap (8) — lines up with the item text column.
        marginLeft: 25,
        fontSize: fs(12.5),
        color: hover ? theme.text : secondaryText(theme),
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: 0,
        transition: "color 0.12s ease",
      }) as CSSProperties,

    /* ---- linked-milestone progress (kept) ---- */
    milestone: {
      marginTop: 8,
      padding: 8,
      border: `1px solid ${surfaceBorder(theme)}`,
      borderRadius: 8,
      background: surfaceBg(theme),
    } as CSSProperties,
    milestoneHeader: {
      display: "flex",
      justifyContent: "space-between",
      gap: 8,
      fontSize: fs(12),
      marginBottom: 6,
    } as CSSProperties,
    milestoneTitle: {
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      fontWeight: 600,
    } as CSSProperties,
    milestonePercent: { flexShrink: 0, fontWeight: 600 } as CSSProperties,
    progressTrack: {
      height: 6,
      width: "100%",
      borderRadius: 9999,
      background: dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
      overflow: "hidden",
    } as CSSProperties,
    progressFill: (percent: number) =>
      ({
        height: "100%",
        width: `${percent}%`,
        background: theme.brand,
      }) as CSSProperties,

    /* ---- detail view (one item, opened from the timeline) ---- */
    // The byline name — heavier than a card's, it's the "who asked first" anchor.
    detailAuthorName: {
      fontSize: fs(14),
      fontWeight: 500,
      color: primaryText(theme),
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    } as CSSProperties,
    detailShipped: { fontSize: fs(12), color: secondaryText(theme) } as CSSProperties,
    detailTitle: {
      margin: "14px 0 0",
      fontSize: fs(17),
      fontWeight: 400,
      lineHeight: 1.3,
      color: primaryText(theme),
    } as CSSProperties,
    // The full body (the card clamps to 2 lines; here it runs). theme.text, not
    // primaryText — the detail's prose is the one place we want full contrast.
    detailDescription: {
      marginTop: 10,
      fontSize: fs(14),
      lineHeight: 1.6,
      color: theme.text,
      wordBreak: "break-word",
    } as CSSProperties,
    // Footer rule: status (column) on the left, the "N people asked" rollup right.
    detailFooter: {
      marginTop: 16,
      paddingTop: 12,
      borderTop: `1px solid ${surfaceBorder(theme)}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    } as CSSProperties,
    detailStatus: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      fontSize: fs(12.5),
      fontWeight: 600,
      color: secondaryText(theme),
    } as CSSProperties,
    detailPeopleAsked: {
      fontSize: fs(12.5),
      color: secondaryText(theme),
    } as CSSProperties,
  };
}
