"use client";

import { useFeedockContext } from "../../context";
import { roadmapColumnLabel } from "./roadmap-columns";
import { roadmapStyles } from "./roadmap-styles";
import { primaryText, secondaryText, surfaceBorder } from "../../shared/lib/surface";
import type { PublicRoadmapItem } from "../../types";
import { Avatar } from "../../shared/ui/avatar";
import { DetailBack } from "../../shared/ui/detail-back";
import { RoadmapMilestoneProgress } from "./roadmap-milestone-progress";
import { RoadmapSectionIcon } from "./roadmap-section-icon";
import { SafeHtml } from "../../shared/ui/safe-html";

type Props = {
  item: PublicRoadmapItem;
  onBack: () => void;
  /** Hide the in-body back affordance when the host renders its own (widget). */
  hideBack?: boolean;
};

/**
 * A single roadmap item. Header: back nav + a prominent author byline (who asked
 * first). Then title + full description + milestone. The status (column) and the
 * "N people asked" rollup sit together in a footer row so the item's state +
 * demand read at a glance at the bottom.
 */
export function RoadmapDetail({ item, onBack, hideBack }: Props) {
  const { theme } = useFeedockContext();
  const styles = roadmapStyles(theme);
  const shippedDate = item.shippedAt
    ? new Date(item.shippedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div>
      {hideBack ? null : <DetailBack onBack={onBack} />}

      {item.author ? (
        <div
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            gap: 10,
            minWidth: 0,
          }}
        >
          <Avatar
            name={item.author.name}
            imageUrl={item.author.avatarUrl}
            size={36}
          />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: primaryText(theme),
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {item.author.name}
            </div>
            {shippedDate ? (
              <div style={{ fontSize: 12, color: secondaryText(theme) }}>
                Shipped {shippedDate}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <h3
        style={{
          margin: "14px 0 0",
          fontSize: 17,
          fontWeight: 400,
          lineHeight: 1.3,
          color: primaryText(theme),
        }}
      >
        {item.title}
      </h3>
      {item.description ? (
        <SafeHtml
          html={item.description}
          style={{
            marginTop: 10,
            fontSize: 14,
            lineHeight: 1.6,
            color: theme.text,
            wordBreak: "break-word",
          }}
        />
      ) : null}
      {item.milestone ? (
        <div style={{ marginTop: 12 }}>
          <RoadmapMilestoneProgress milestone={item.milestone} styles={styles} />
        </div>
      ) : null}

      {/* Footer: the item's status (column) + how many people asked. */}
      <div
        style={{
          marginTop: 16,
          paddingTop: 12,
          borderTop: `1px solid ${surfaceBorder(theme)}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12.5,
            fontWeight: 600,
            color: secondaryText(theme),
          }}
        >
          <RoadmapSectionIcon column={item.column} />
          {roadmapColumnLabel(item.column)}
        </span>
        {item.peopleAsked > 0 ? (
          <span style={{ fontSize: 12.5, color: secondaryText(theme) }}>
            {item.peopleAsked} {item.peopleAsked === 1 ? "person" : "people"}{" "}
            asked
          </span>
        ) : null}
      </div>
    </div>
  );
}
