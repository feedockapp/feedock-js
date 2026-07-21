"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useFeedockContext } from "../../context";
import type { PublicComment, PublicUpdateDetail } from "../../types";

/**
 * Fetch one update's detail (body + comments) by its per-project slug, plus a
 * local optimistic `prependComment` — mirrors {@link useFeedbackDetail}. The
 * changelog list carries no comments, so the detail is fetched on open.
 */
export function useUpdateDetail(entrySlug: string) {
  const { client } = useFeedockContext();
  const [detail, setDetail] = useState<PublicUpdateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    client
      .getUpdate(entrySlug)
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
  }, [client, entrySlug]);

  const prependComment = useCallback(
    (comment: PublicComment) =>
      setDetail((d) =>
        d
          ? {
              ...d,
              comments: [comment, ...d.comments],
              commentCount: d.commentCount + 1,
            }
          : d,
      ),
    [],
  );

  return useMemo(
    () => ({ detail, loading, error, prependComment }),
    [detail, loading, error, prependComment],
  );
}
