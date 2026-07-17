"use client";

import { useState } from "react";

import { submitFormStyles } from "./submit-form-styles";
import { useStyles } from "../../shared/lib/use-styles";
import type { SimilarFeedback } from "../../types";
import { useFeedock } from "../../use-feedock";

type Props = {
  item: SimilarFeedback;
};

/** One "upvote instead?" suggestion row — upvotes an existing item in place. */
export function SimilarSuggestionRow({ item }: Props) {
  const { vote } = useFeedock();
  const styles = useStyles(submitFormStyles);
  const [count, setCount] = useState(item.voteCount);
  const [voted, setVoted] = useState(false);
  const [busy, setBusy] = useState(false);

  async function upvote() {
    if (voted || busy) {
      return;
    }
    setBusy(true);
    try {
      const result = await vote(item.id);
      setCount(result.voteCount);
      setVoted(true);
    } catch {
      // Best-effort — leave the row as-is if the vote fails.
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.suggestionRow}>
      <span style={styles.suggestionText} title={item.title}>
        {item.title}
      </span>
      <button
        type="button"
        onClick={upvote}
        disabled={voted || busy}
        style={styles.suggestionVote(voted)}
        aria-label={voted ? `Upvoted ${item.title}` : `Upvote ${item.title}`}
      >
        ▲ {count}
        {voted ? " ✓" : ""}
      </button>
    </div>
  );
}
