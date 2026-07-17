"use client";

import { useEffect, useRef, useState } from "react";

import { useFeedockContext } from "../../context";
import type { SimilarFeedback } from "../../types";

const DEBOUNCE_MS = 450;
/** Don't query on a couple of characters — wait for a meaningful title. */
const MIN_TITLE_LENGTH = 4;

/**
 * Debounced dedupe lookup for the composer: as the visitor types a title (and
 * body), fetch PUBLIC feedback that looks similar so the UI can offer "upvote
 * instead?". Best-effort — an error or a project with embeddings disabled just
 * yields []. Uses the memoized `client` from context (stable) and a monotonic
 * sequence guard so a slow response never overwrites a newer one.
 */
export function useSimilarFeedback(
  title: string,
  body: string,
): SimilarFeedback[] {
  const { client } = useFeedockContext();
  const [matches, setMatches] = useState<SimilarFeedback[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    const trimmed = title.trim();
    if (trimmed.length < MIN_TITLE_LENGTH) {
      // Bump the sequence here too, or an in-flight request from before the
      // title was cut short still passes the `mySeq === seq.current` check and
      // repopulates matches for text the visitor already deleted.
      seq.current += 1;
      setMatches([]);
      return;
    }
    const mySeq = ++seq.current;
    const timer = setTimeout(() => {
      client
        .similarFeedback({ title: trimmed, body: body.trim() || undefined })
        .then((rows) => {
          if (mySeq === seq.current) {
            setMatches(rows);
          }
        })
        .catch(() => {
          if (mySeq === seq.current) {
            setMatches([]);
          }
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [title, body, client]);

  return matches;
}
