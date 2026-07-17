"use client";

import { useFeedockContext } from "../context";
import { submitFormStyles } from "../lib/submit-form-styles";
import type { SimilarFeedback } from "../types";
import { SimilarSuggestionRow } from "./similar-suggestion-row";

type Props = {
  matches: SimilarFeedback[];
};

/**
 * Dedupe-at-submit panel: PUBLIC feedback similar to what the visitor is
 * drafting, each upvotable in place ("upvote instead?"). Renders nothing when
 * there are no matches (embeddings disabled or draft too different) — the
 * composer stays clean and the visitor can always post their own item.
 */
export function SimilarSuggestions({ matches }: Props) {
  const { theme } = useFeedockContext();
  const styles = submitFormStyles(theme);
  if (matches.length === 0) {
    return null;
  }

  return (
    <div style={styles.suggestions}>
      <div style={styles.suggestionsTitle}>
        Someone may have already asked. Upvote instead?
      </div>
      {matches.map((item) => (
        <SimilarSuggestionRow key={item.id} item={item} />
      ))}
    </div>
  );
}
