"use client";

import { useEffect, useReducer } from "react";

import { useFeedockContext } from "../context";
import type { PublicUpdate } from "../types";

type ChangelogState = {
  items: PublicUpdate[];
  loading: boolean;
  error: string | null;
};

type ChangelogAction =
  | { type: "loading" }
  | { type: "loaded"; items: PublicUpdate[] }
  | { type: "failed"; error: string };

function changelogReducer(
  state: ChangelogState,
  action: ChangelogAction,
): ChangelogState {
  switch (action.type) {
    case "loading":
      return { ...state, loading: true, error: null };
    case "loaded":
      return { items: action.items, loading: false, error: null };
    case "failed":
      return { ...state, loading: false, error: action.error };
  }
}

/**
 * Fetch published updates for the `<Changelog>` surface. One reducer collapses
 * the load lifecycle into a single dispatch per transition (no scattered
 * setState), and an `active` flag drops a resolved fetch after unmount.
 */
export function useChangelog(reloadKey = 0): ChangelogState {
  const { client } = useFeedockContext();
  const [state, dispatch] = useReducer(changelogReducer, {
    items: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let active = true;
    dispatch({ type: "loading" });
    client
      .listUpdates()
      .then((page) => active && dispatch({ type: "loaded", items: page.items }))
      .catch(
        (e: unknown) =>
          active &&
          dispatch({
            type: "failed",
            error: e instanceof Error ? e.message : "Failed to load.",
          }),
      );
    return () => {
      active = false;
    };
    // `reloadKey` bumps when the host re-opens the widget — refetch fresh data.
  }, [client, reloadKey]);

  return state;
}
