"use client";

import { useState } from "react";

import type { RoadmapStyles } from "../lib/roadmap-styles";
import type { PublicRoadmapColumnGroup } from "../types";
import { Avatar } from "./avatar";
import { RoadmapMilestoneProgress } from "./roadmap-milestone-progress";
import { SafeHtml } from "./safe-html";

type RoadmapItem = PublicRoadmapColumnGroup["items"][number];

type Props = {
  item: RoadmapItem;
  /** The column this item is in (drives the compact Shipped layout). */
  column: string;
  /** Timeline node color for this section. */
  color: string;
  /** Last item in the section — omit the connector line + divider below it. */
  isLast: boolean;
  styles: RoadmapStyles;
  /** Open this item's detail view. */
  onOpen: () => void;
};

/** A short "Jun 18" date (no year) for Shipped items. */
function shippedDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** One roadmap item on the timeline: a node + connector, then a tappable body. */
export function RoadmapCard({
  item,
  column,
  color,
  isLast,
  styles,
  onOpen,
}: Props) {
  const shipped = column === "Shipped";
  const [hover, setHover] = useState(false);
  return (
    <div style={styles.itemRow}>
      <div style={styles.rail}>
        {isLast ? null : <span style={styles.line(color)} />}
        <span style={styles.node(color)} />
      </div>
      <button
        type="button"
        onClick={onOpen}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={styles.itemContent(isLast)}
      >
        <div style={styles.titleRow}>
          <span style={styles.itemTitle(hover)}>{item.title}</span>
          {shipped ? (
            item.shippedAt ? (
              <span style={styles.date}>{shippedDate(item.shippedAt)}</span>
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
          <RoadmapMilestoneProgress milestone={item.milestone} styles={styles} />
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
