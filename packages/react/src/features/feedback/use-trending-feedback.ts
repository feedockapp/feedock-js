"use client";

import { useFeedockContext } from "../../context";
import { usePublicResource } from "../../shared/hooks/use-public-resource";
import type { PublicFeedbackListItem } from "../../types";

/**
 * Fetch the top feedback for the Home "trending" section. A thin projection over
 * `usePublicResource`: Home reads `{ items, loading }` and leaves `error` alone
 * (an empty trending list is a fine failure mode), but the error is captured
 * rather than swallowed, so a failure here is visible to a caller that wants it.
 */
export function useTrendingFeedback(reloadKey = 0): {
  items: PublicFeedbackListItem[];
  loading: boolean;
  error: string | null;
} {
  const { client } = useFeedockContext();
  const { data, loading, error } = usePublicResource(
    (c) => c.listFeedback({ sort: "top" }),
    // `reloadKey` bumps when the host re-opens the widget — refetch fresh data.
    [client, reloadKey],
  );
  return { items: data?.items ?? [], loading, error };
}
