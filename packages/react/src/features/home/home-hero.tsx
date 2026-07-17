"use client";

import { useState, type CSSProperties } from "react";

import { homeStyles } from "./home-styles";
import { DATE_STYLE, formatDate } from "../../shared/lib/format";
import { useStyles } from "../../shared/lib/use-styles";
import type { PublicUpdate } from "../../types";
import { Avatar } from "../../shared/ui/avatar";
import { toExcerpt } from "../changelog";

export type Props = {
  update: PublicUpdate;
  /** Open this update's detail (the Home hero is the featured spot). */
  onOpen?: (id: string) => void;
};

/** Fully static (no theme/hover deps) — hoisted so it isn't rebuilt each render. */
const COVER_STYLE: CSSProperties = {
  width: "100%",
  maxHeight: 160,
  objectFit: "cover",
  borderRadius: 10,
  display: "block",
  marginBottom: 12,
};

const EXCERPT_LENGTH = 150;

/** The latest published update, as a tappable hero card. */
export function HomeHero({ update, onOpen }: Props) {
  const styles = useStyles(homeStyles);
  const [hover, setHover] = useState(false);
  const excerpt = update.whyItMatters || toExcerpt(update.body, EXCERPT_LENGTH);

  return (
    <button
      type="button"
      onClick={() => onOpen?.(update.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={styles.hero}
    >
      {update.coverImageUrl ? (
        <img src={update.coverImageUrl} alt="" style={COVER_STYLE} />
      ) : null}
      <div style={styles.heroEyebrow}>
        {update.category}
        <span style={styles.heroEyebrowDate}>
          · {formatDate(update.publishedAt, DATE_STYLE.Short)}
        </span>
      </div>
      <h3 style={styles.heroTitle(hover)}>{update.title}</h3>
      {excerpt ? <p style={styles.heroExcerpt}>{excerpt}</p> : null}
      {update.author ? (
        <span style={styles.heroAuthor}>
          <Avatar
            name={update.author.name}
            imageUrl={update.author.avatarUrl}
            size={20}
          />
          <span style={styles.heroAuthorName}>{update.author.name}</span>
        </span>
      ) : null}
    </button>
  );
}
