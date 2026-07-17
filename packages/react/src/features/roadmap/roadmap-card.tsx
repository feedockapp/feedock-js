"use client";

import { memo, useState } from "react";

import { ROADMAP_COLUMN } from "./roadmap-columns";
import { roadmapStyles } from "./roadmap-styles";
import { DATE_STYLE, formatDate } from "../../shared/lib/format";
import { useStyles } from "../../shared/lib/use-styles";
import type { PublicRoadmapColumnGroup, RoadmapColumn } from "../../types";
import { Avatar } from "../../shared/ui/avatar";
import { RoadmapMilestoneProgress } from "./roadmap-milestone-progress";
import { SafeHtml } from "../../shared/ui/safe-html";

type RoadmapItem = PublicRoadmapColumnGroup["items"][number];

export type Props = {
  item: RoadmapItem;
  /** The column this item is in (drives the compact Shipped layout). */
  column: RoadmapColumn;
  /** Timeline node color for this section. */
  color: string;
  /** Last item in the section — omit the connector line + divider below it. */
  isLast: boolean;
  /**
   * Open an item's detail. Takes the id (rather than a per-item `onOpen()`
   * closure) so ONE stable callback serves every card — a fresh arrow per row
   * would defeat the memo below.
   */
  onSelect: (id: string) => void;
};

/** One roadmap item on the timeline: a node + connector, then a tappable body. */
function RoadmapCardImpl({ item, column, color, isLast, onSelect }: Props) {
  const styles = useStyles(roadmapStyles);
  const shipped = column === ROADMAP_COLUMN.Shipped;
  const [hover, setHover] = useState(false);

  return (
    <div style={styles.itemRow}>
      <div style={styles.rail}>
        {isLast ? null : <span style={styles.line(color)} />}
        <span style={styles.node(color)} />
      </div>
      <button
        type="button"
        onClick={() => onSelect(item.id)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={styles.itemContent(isLast)}
      >
        <div style={styles.titleRow}>
          <span style={styles.itemTitle(hover)}>{item.title}</span>
          {shipped ? (
            item.shippedAt ? (
              <span style={styles.date}>
                {formatDate(item.shippedAt, DATE_STYLE.Short)}
              </span>
            ) : null
          ) : (
            <span style={styles.pill}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M5 15l7-7 7 7"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {item.peopleAsked}
            </span>
          )}
        </div>
        {!shipped && item.description ? (
          <SafeHtml html={item.description} style={styles.description} />
        ) : null}
        {!shipped && item.milestone ? (
          <RoadmapMilestoneProgress milestone={item.milestone} />
        ) : null}
        {item.author ? (
          <span style={styles.authorRow}>
            <Avatar
              name={item.author.name}
              imageUrl={item.author.avatarUrl}
              size={16}
            />
            <span style={styles.authorName}>{item.author.name}</span>
          </span>
        ) : null}
      </button>
    </div>
  );
}

/**
 * Memoized, and every prop is now stable: `item` comes off the roadmap fetch
 * (identity holds between refetches), `column`/`color`/`isLast` are primitives,
 * and `onSelect` is the `select` callback from `useDetailSelection` (useCallback,
 * empty deps). The style map used to arrive as a freshly-allocated prop on every
 * parent render, which made memoizing this impossible; it reads its own now.
 */
export const RoadmapCard = memo(RoadmapCardImpl);
