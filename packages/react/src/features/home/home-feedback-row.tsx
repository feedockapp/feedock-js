"use client";

import { useState } from "react";

import { useFeedockContext } from "../../context";
import { homeStyles } from "./home-styles";
import { useStyles } from "../../shared/lib/use-styles";
import { statusTone } from "../../theme";
import type { PublicFeedbackListItem } from "../../types";
import { Caret } from "./home-caret";
import { StatusIcon } from "../feedback";

export type Props = {
  item: PublicFeedbackListItem;
  /** First row in the section — no divider above it. */
  first: boolean;
  /** Open this item's detail on the Feedback tab. */
  onOpen?: (id: string) => void;
};

/** One trending-feedback row: status dot + title/status + vote pill. */
export function HomeFeedbackRow({ item, first, onOpen }: Props) {
  const { theme } = useFeedockContext();
  const styles = useStyles(homeStyles);
  const [hover, setHover] = useState(false);
  const tone = statusTone(item.status);

  return (
    <button
      type="button"
      onClick={() => onOpen?.(item.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={styles.row(first)}
    >
      <span style={styles.statusIcon(tone.fg)}>
        <StatusIcon status={item.status} />
      </span>
      <span style={styles.rowMain}>
        <span style={styles.rowTitle(hover)}>{item.title}</span>
        <span style={styles.rowSub}>{tone.label}</span>
      </span>
      <span style={styles.votePill}>
        <Caret color={theme.brand} />
        {item.voteCount}
      </span>
    </button>
  );
}
