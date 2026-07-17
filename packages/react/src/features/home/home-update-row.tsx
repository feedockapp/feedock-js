"use client";

import { useState } from "react";

import { homeStyles } from "./home-styles";
import { DATE_STYLE, formatDate } from "../../shared/lib/format";
import { useStyles } from "../../shared/lib/use-styles";
import type { PublicUpdate } from "../../types";

export type Props = {
  update: PublicUpdate;
  /** First row in the section — no divider above it. */
  first: boolean;
  /** Open this update's detail on the What's New tab. */
  onOpen?: (id: string) => void;
};

/** One recent-update row: date + title. */
export function HomeUpdateRow({ update, first, onOpen }: Props) {
  const styles = useStyles(homeStyles);
  const [hover, setHover] = useState(false);

  return (
    <button
      type="button"
      onClick={() => onOpen?.(update.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={styles.row(first)}
    >
      <span style={styles.updateDate}>
        {formatDate(update.publishedAt, DATE_STYLE.Short)}
      </span>
      <span style={styles.rowMain}>
        <span style={styles.rowTitle(hover)}>{update.title}</span>
      </span>
    </button>
  );
}
