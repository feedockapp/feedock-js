"use client";

import { useEffect, useReducer } from "react";

import { useFeedockContext } from "../../context";
import type { PublicRoadmapColumnGroup } from "../../types";

export type UseRoadmap = {
  columns: PublicRoadmapColumnGroup[];
  loading: boolean;
  error: string | null;
};

type RoadmapAction =
  | { type: "loading" }
  | { type: "loaded"; columns: PublicRoadmapColumnGroup[] }
  | { type: "failed"; error: string };

function roadmapReducer(state: UseRoadmap, action: RoadmapAction): UseRoadmap {
  switch (action.type) {
    case "loading":
      return { ...state, loading: true, error: null };
    case "loaded":
      return { columns: action.columns, loading: false, error: null };
    case "failed":
      // Keep the columns a failed REFETCH couldn't replace. Clearing them threw
      // away a roadmap the visitor was already reading because a later reload
      // (the widget bumps reloadKey on every open) happened to fail.
      return { ...state, loading: false, error: action.error };
  }
}

/** Fetch state for the embeddable public roadmap. */
export function useRoadmap(reloadKey = 0): UseRoadmap {
  const { client } = useFeedockContext();
  const [state, dispatch] = useReducer(roadmapReducer, {
    columns: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let active = true;
    dispatch({ type: "loading" });
    client
      .getRoadmap()
      .then((columns) => {
        if (active) {
          dispatch({ type: "loaded", columns });
        }
      })
      .catch((e: unknown) => {
        if (active) {
          dispatch({
            type: "failed",
            error: e instanceof Error ? e.message : "Failed to load.",
          });
        }
      });
    return () => {
      active = false;
    };
    // `reloadKey` bumps when the host re-opens the widget — refetch fresh data.
  }, [client, reloadKey]);

  return state;
}
