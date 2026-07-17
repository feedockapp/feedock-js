"use client";

import { useFeedockContext } from "../../context";
import { usePublicResource } from "../../shared/hooks/use-public-resource";
import type { PublicRoadmapColumnGroup } from "../../types";

export type UseRoadmap = {
  columns: PublicRoadmapColumnGroup[];
  loading: boolean;
  error: string | null;
};

/**
 * Fetch state for the embeddable public roadmap. A thin projection over
 * `usePublicResource`, which keeps the last columns on a failed refetch — so a
 * transient failure on a widget re-open doesn't blank a roadmap the visitor is
 * already reading.
 */
export function useRoadmap(reloadKey = 0): UseRoadmap {
  const { client } = useFeedockContext();
  const { data, loading, error } = usePublicResource(
    (c) => c.getRoadmap(),
    // `reloadKey` bumps when the host re-opens the widget — refetch fresh data.
    [client, reloadKey],
  );
  return { columns: data ?? [], loading, error };
}
