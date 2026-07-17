"use client";

import type { CSSProperties } from "react";

import { roadmapColumnLabel } from "./roadmap-columns";
import { roadmapStyles } from "./roadmap-styles";
import { DATE_STYLE, formatDate, plural } from "../../shared/lib/format";
import { useStyles } from "../../shared/lib/use-styles";
import type { PublicRoadmapItem } from "../../types";
import { Avatar } from "../../shared/ui/avatar";
import { DetailBack } from "../../shared/ui/detail-back";
import { RoadmapMilestoneProgress } from "./roadmap-milestone-progress";
import { RoadmapSectionIcon } from "./roadmap-section-icon";
import { SafeHtml } from "../../shared/ui/safe-html";

export type Props = {
  item: PublicRoadmapItem;
  onBack: () => void;
  /** Hide the in-body back affordance when the host renders its own (widget). */
  hideBack?: boolean;
};

/** Byline row: the avatar beside the name/ship-date stack. */
const AUTHOR_ROW: CSSProperties = {
  marginTop: 12,
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
};

/** Lets a long name ellipsize instead of stretching the byline row. */
const AUTHOR_TEXT: CSSProperties = { minWidth: 0 };

/** Gap above the linked-milestone block. */
const MILESTONE_SLOT: CSSProperties = { marginTop: 12 };

/**
 * A single roadmap item. Header: back nav + a prominent author byline (who asked
 * first). Then title + full description + milestone. The status (column) and the
 * "N people asked" rollup sit together in a footer row so the item's state +
 * demand read at a glance at the bottom.
 */
export function RoadmapDetail({ item, onBack, hideBack }: Props) {
  const styles = useStyles(roadmapStyles);
  const shippedDate = item.shippedAt
    ? formatDate(item.shippedAt, DATE_STYLE.Long)
    : null;

  return (
    <div>
      {hideBack ? null : <DetailBack onBack={onBack} />}

      {item.author ? (
        <div style={AUTHOR_ROW}>
          <Avatar
            name={item.author.name}
            imageUrl={item.author.avatarUrl}
            size={36}
          />
          <div style={AUTHOR_TEXT}>
            <div style={styles.detailAuthorName}>{item.author.name}</div>
            {shippedDate ? (
              <div style={styles.detailShipped}>Shipped {shippedDate}</div>
            ) : null}
          </div>
        </div>
      ) : null}

      <h3 style={styles.detailTitle}>{item.title}</h3>
      {item.description ? (
        <SafeHtml html={item.description} style={styles.detailDescription} />
      ) : null}
      {item.milestone ? (
        <div style={MILESTONE_SLOT}>
          <RoadmapMilestoneProgress milestone={item.milestone} />
        </div>
      ) : null}

      {/* Footer: the item's status (column) + how many people asked. */}
      <div style={styles.detailFooter}>
        <span style={styles.detailStatus}>
          <RoadmapSectionIcon column={item.column} />
          {roadmapColumnLabel(item.column)}
        </span>
        {item.peopleAsked > 0 ? (
          <span style={styles.detailPeopleAsked}>
            {plural(item.peopleAsked, "person", "people")} asked
          </span>
        ) : null}
      </div>
    </div>
  );
}
