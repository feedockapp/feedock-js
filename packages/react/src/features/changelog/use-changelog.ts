"use client";

import { useFeedockContext } from "../../context";
import { usePublicResource } from "../../shared/hooks/use-public-resource";
import type { PublicUpdate } from "../../types";

type ChangelogState = {
  items: PublicUpdate[];
  loading: boolean;
  error: string | null;
};

/**
 * Fetch published updates for the `<Changelog>` surface. A thin projection over
 * `usePublicResource` — the shared hook owns the fetch lifecycle; this maps its
 * page to a plain `items` list.
 */
export function useChangelog(reloadKey = 0): ChangelogState {
  const { client } = useFeedockContext();
  const { data, loading, error } = usePublicResource(
    (c) => c.listUpdates(),
    // `reloadKey` bumps when the host re-opens the widget — refetch fresh data.
    [client, reloadKey],
  );
  return { items: data?.items ?? [], loading, error };
}
