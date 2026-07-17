"use client";

import { useEffect, useState } from "react";

import { useFeedockContext } from "../../context";
import type { PublicFeedbackListItem } from "../../types";

/** Fetch the top feedback for the Home "trending" section (best-effort). */
export function useTrendingFeedback(reloadKey = 0): {
  items: PublicFeedbackListItem[];
  loading: boolean;
} {
  const { client } = useFeedockContext();
  const [items, setItems] = useState<PublicFeedbackListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    client
      .listFeedback({ sort: "top" })
      .then((page) => {
        if (active) {
          setItems(page.items);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
    // `reloadKey` bumps when the host re-opens the widget — refetch fresh data.
  }, [client, reloadKey]);

  return { items, loading };
}
