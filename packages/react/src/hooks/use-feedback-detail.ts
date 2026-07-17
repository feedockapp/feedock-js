"use client";

import { useEffect, useState } from "react";

import { useFeedockContext } from "../context";
import type { PublicComment, PublicFeedbackDetail } from "../types";

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

  const setVoteCount = (voteCount: number) =>
    setDetail((d) => (d ? { ...d, voteCount } : d));

  const prependComment = (comment: PublicComment) =>
    setDetail((d) => (d ? { ...d, comments: [comment, ...d.comments] } : d));

  return { detail, loading, error, setVoteCount, prependComment };
}
