"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useFeedockContext } from "../../context";
import type { PublicComment, PublicFeedbackDetail } from "../../types";

/** Fetch one feedback item's detail (body + comments) + local optimistic mutators. */
export function useFeedbackDetail(id: string) {
  const { client } = useFeedockContext();
  const [detail, setDetail] = useState<PublicFeedbackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    client
      .getItem(id)
      .then((d) => {
        if (active) {
          setDetail(d);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (active) {
          setError(e instanceof Error ? e.message : "Failed to load.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [client, id]);

  // Both take the updater form, so neither closes over `detail` and both stay
  // stable for the life of the hook.
  const setVoteCount = useCallback(
    (voteCount: number) => setDetail((d) => (d ? { ...d, voteCount } : d)),
    [],
  );

  const prependComment = useCallback(
    (comment: PublicComment) =>
      setDetail((d) =>
        d
          ? {
              ...d,
              comments: [comment, ...d.comments],
              // Keep the count in step with the list, or the "Comments · N"
              // header stays one behind after posting.
              commentCount: d.commentCount + 1,
            }
          : d,
      ),
    [],
  );

  return useMemo(
    () => ({ detail, loading, error, setVoteCount, prependComment }),
    [detail, loading, error, setVoteCount, prependComment],
  );
}
