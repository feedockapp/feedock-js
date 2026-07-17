"use client";

import { useState } from "react";

import { useFeedockContext } from "../../context";
import { formatDate } from "../../shared/lib/format";
import { toExcerpt } from "./latest-update-text";
import { primaryText, secondaryText } from "../../shared/lib/surface";
import type { PublicUpdate } from "../../types";
import { Avatar } from "../../shared/ui/avatar";

type Props = {
  update: PublicUpdate;
  /** Open this entry's detail view. */
  onSelect: (id: string) => void;
};

/** Fully static (no theme/hover deps) — hoisted so it isn't rebuilt each render. */
const ROW_BUTTON_STYLE = {
  display: "block",
  width: "100%",
  textAlign: "left",
  background: "transparent",
  border: "none",
  padding: 0,
  margin: 0,
  font: "inherit",
  color: "inherit",
  cursor: "pointer",
} as const;

/**
 * One row in the "What's New" list: a compact, tappable summary (category · date,
 * title, one-line excerpt, author). Clicking opens the full detail — the body +
 * inline images live there, not in the list. Title brightens on hover as the
 * click affordance (matching the Home hero / feedback rows).
 */
export function ChangelogListItem({ update, onSelect }: Props) {
  const { theme } = useFeedockContext();
  const [hover, setHover] = useState(false);
  const excerpt = update.whyItMatters || toExcerpt(update.body, 140);

  return (
    <button
      type="button"
      onClick={() => onSelect(update.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={ROW_BUTTON_STYLE}
    >
      {update.coverImageUrl ? (
        <img
          src={update.coverImageUrl}
          alt=""
          style={{
            width: "100%",
            maxHeight: 160,
            objectFit: "cover",
            borderRadius: 8,
            display: "block",
            marginBottom: 12,
          }}
        />
      ) : null}
      {/* Eyebrow: category + date (no pill), matching the Home hero. */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: 0.5,
            textTransform: "uppercase",
            color: theme.brand,
          }}
        >
          {update.category}
        </span>
        <span
          style={{ fontSize: 11, fontWeight: 500, color: secondaryText(theme) }}
        >
          · {formatDate(update.publishedAt)}
        </span>
      </div>
      <h3
        style={{
          margin: "8px 0 0",
          fontSize: 16,
          fontWeight: 400,
          lineHeight: 1.3,
          color: hover ? theme.text : primaryText(theme),
          transition: "color 0.12s ease",
        }}
      >
        {update.title}
      </h3>
      {excerpt ? (
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 13,
            lineHeight: 1.5,
            color: secondaryText(theme),
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {excerpt}
        </p>
      ) : null}
      {update.author ? (
        <span
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: 0,
          }}
        >
          <Avatar
            name={update.author.name}
            imageUrl={update.author.avatarUrl}
            size={20}
          />
          <span
            style={{
              fontSize: 12.5,
              color: secondaryText(theme),
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {update.author.name}
          </span>
        </span>
      ) : null}
    </button>
  );
}
