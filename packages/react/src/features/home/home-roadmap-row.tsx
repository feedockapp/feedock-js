"use client";

import { useState } from "react";

import { useFeedockContext } from "../../context";
import { homeStyles } from "./home-styles";
import { useStyles } from "../../shared/lib/use-styles";
import type { PublicRoadmapItem } from "../../types";
import { Caret } from "./home-caret";

export type Props = {
  item: PublicRoadmapItem;
  /** First row in the section — no divider above it. */
  first: boolean;
  /** Open this item's detail on the Roadmap tab. */
  onOpen?: (id: string) => void;
};

/** One in-progress roadmap row: title + "who asked" pill. */
export function HomeRoadmapRow({ item, first, onOpen }: Props) {
  const { theme } = useFeedockContext();
  const styles = useStyles(homeStyles);
  const [hover, setHover] = useState(false);

  return (
    <button
      type="button"
      onClick={() => onOpen?.(item.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={styles.row(first)}
    >
      <span style={styles.rowMain}>
        <span style={styles.rowTitle(hover)}>{item.title}</span>
      </span>
      {item.peopleAsked > 0 ? (
        <span style={styles.votePill}>
          <Caret color={theme.brand} />
          {item.peopleAsked}
        </span>
      ) : null}
    </button>
  );
}
