"use client";

import type { CSSProperties } from "react";

import { formatDate } from "../../shared/lib/format";
import { changelogDetailStyles } from "./changelog-detail-styles";
import { useStyles } from "../../shared/lib/use-styles";
import type { PublicUpdate } from "../../types";
import { Avatar } from "../../shared/ui/avatar";
import { DetailBack } from "../../shared/ui/detail-back";
import { SafeHtml } from "../../shared/ui/safe-html";

export type Props = {
  update: PublicUpdate;
  onBack: () => void;
  /** Hide the in-body back affordance when the host renders its own (widget). */
  hideBack?: boolean;
};

/** Fully static (no theme/hover deps) — hoisted so they aren't rebuilt each render. */
const AUTHOR_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

/** Cover (hero) — after the header, before the body. */
const COVER_STYLE: CSSProperties = {
  width: "100%",
  maxHeight: 240,
  objectFit: "cover",
  borderRadius: 10,
  display: "block",
  margin: "14px 0 0",
};

/**
 * A single published update, as an article: a category eyebrow leads, then the
 * title, a why-it-matters line, a byline (author · date), the cover image, and
 * the full body.
 */
export function ChangelogDetail({ update, onBack, hideBack }: Props) {
  const styles = useStyles(changelogDetailStyles);
  return (
    <div>
      {hideBack ? null : <DetailBack onBack={onBack} />}

      <div style={styles.eyebrow}>{update.category}</div>

      <h3 style={styles.title}>{update.title}</h3>
      {update.whyItMatters ? (
        <p style={styles.whyItMatters}>{update.whyItMatters}</p>
      ) : null}

      <div style={styles.byline}>
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
        <span>
          {update.author ? "· " : ""}
          {formatDate(update.publishedAt)}
        </span>
      </div>

      {update.coverImageUrl ? (
        <img src={update.coverImageUrl} alt="" style={COVER_STYLE} />
      ) : null}

      <SafeHtml html={update.body} style={styles.body} />
    </div>
  );
}
