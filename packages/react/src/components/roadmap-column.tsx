"use client";

import { useState } from "react";

import { roadmapColumnColor, roadmapColumnLabel } from "../lib/roadmap";
import type { RoadmapStyles } from "../lib/roadmap-styles";
import type { PublicRoadmapColumnGroup } from "../types";
import { RoadmapCard } from "./roadmap-card";
import { RoadmapSectionIcon } from "./roadmap-section-icon";

type Props = {
  group: PublicRoadmapColumnGroup;
  styles: RoadmapStyles;
  /** Open an item's detail view. */
  onSelect: (id: string) => void;
};

/** How many items a column shows before "Show more". */
const COLLAPSED_COUNT = 4;

/** One roadmap status section: a per-column glyph header + a capped timeline. */
export function RoadmapColumn({ group, styles, onSelect }: Props) {
  const color = roadmapColumnColor(group.column);
  const [expanded, setExpanded] = useState(false);
  const [hover, setHover] = useState(false);

  const total = group.items.length;
  const hasMore = total > COLLAPSED_COUNT;
  const shown = expanded ? group.items : group.items.slice(0, COLLAPSED_COUNT);

  return (
    <section style={styles.column}>
      <div style={styles.columnHead}>
        <span style={styles.columnIcon}>
          <RoadmapSectionIcon column={group.column} />
        </span>
        <span style={styles.columnTitle}>
          {roadmapColumnLabel(group.column)}
        </span>
        <span style={styles.count}>{String(total).padStart(2, "0")}</span>
      </div>
      {shown.map((item, i) => (
        <RoadmapCard
          key={item.id}
          item={item}
          column={group.column}
          color={color}
          isLast={i === shown.length - 1}
          styles={styles}
          onOpen={() => onSelect(item.id)}
        />
      ))}
      {hasMore && !expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={styles.showMore(hover)}
        >
          Show more <span aria-hidden>⌄</span>
        </button>
      ) : null}
    </section>
  );
}
