"use client";

import { memo, useState, type CSSProperties } from "react";

import { formatDate } from "../../shared/lib/format";
import { toExcerpt } from "./latest-update-text";
import { changelogListItemStyles } from "./changelog-list-item-styles";
import { useStyles } from "../../shared/lib/use-styles";
import type { PublicUpdate } from "../../types";
import { Avatar } from "../../shared/ui/avatar";

export type Props = {
  update: PublicUpdate;
  /** Open this entry's detail view. */
  onSelect: (id: string) => void;
};

/** Fully static (no theme/hover deps) — hoisted so they aren't rebuilt each render. */
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

const COVER_STYLE: CSSProperties = {
  width: "100%",
  maxHeight: 160,
  objectFit: "cover",
  borderRadius: 8,
  display: "block",
  marginBottom: 12,
};

/** Eyebrow: category + date (no pill), matching the Home hero. */
const EYEBROW_STYLE: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
};

const AUTHOR_STYLE: CSSProperties = {
  marginTop: 12,
  display: "flex",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
};

/**
 * One row in the "What's New" list: a compact, tappable summary (category · date,
 * title, one-line excerpt, author). Clicking opens the full detail — the body +
 * inline images live there, not in the list. Title brightens on hover as the
 * click affordance (matching the Home hero / feedback rows).
 */
function ChangelogListItemImpl({ update, onSelect }: Props) {
  const styles = useStyles(changelogListItemStyles);
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
        <img src={update.coverImageUrl} alt="" style={COVER_STYLE} />
      ) : null}
      <div style={EYEBROW_STYLE}>
        <span style={styles.category}>{update.category}</span>
        <span style={styles.date}>· {formatDate(update.publishedAt)}</span>
      </div>
      <h3 style={styles.title(hover)}>{update.title}</h3>
      {excerpt ? <p style={styles.excerpt}>{excerpt}</p> : null}
      {update.author ? (
        <span style={AUTHOR_STYLE}>
          <Avatar
            name={update.author.name}
            imageUrl={update.author.avatarUrl}
            size={20}
          />
          <span style={styles.authorName}>{update.author.name}</span>
        </span>
      ) : null}
    </button>
  );
}

/**
 * Memoized: `update` comes off the changelog fetch (identity holds between
 * refetches) and `onSelect` is `select` from `useDetailSelection` (useCallback,
 * empty deps). Hover lives in local state, so a hover redraws this row only.
 */
export const ChangelogListItem = memo(ChangelogListItemImpl);
