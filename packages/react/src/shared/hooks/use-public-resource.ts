"use client";

import { useEffect, useReducer, type DependencyList } from "react";

import type { FeedockClient } from "../../client";
import { useFeedockContext } from "../../context";

export type PublicResource<T> = {
  /** The last successful value, or null before the first one lands. */
  data: T | null;
  loading: boolean;
  /** A failed fetch's message, or null. Present even on surfaces that don't
   *  render it — a caller may ignore it, but nothing here swallows it. */
  error: string | null;
};

/** Reducer action tags, named so the switch and the dispatches can't drift. */
const RESOURCE_ACTION = {
  Loading: "loading",
  Loaded: "loaded",
  Failed: "failed",
} as const;

type ResourceAction<T> =
  | { type: typeof RESOURCE_ACTION.Loading }
  | { type: typeof RESOURCE_ACTION.Loaded; data: T }
  | { type: typeof RESOURCE_ACTION.Failed; error: string };

function resourceReducer<T>(
  state: PublicResource<T>,
  action: ResourceAction<T>,
): PublicResource<T> {
  switch (action.type) {
    case RESOURCE_ACTION.Loading:
      return { ...state, loading: true, error: null };
    case RESOURCE_ACTION.Loaded:
      return { data: action.data, loading: false, error: null };
    case RESOURCE_ACTION.Failed:
      // Keep the last good data. A failed REFETCH must not blank a surface the
      // visitor is already reading — the widget bumps its reload on every open,
      // so a transient failure there would otherwise wipe the screen. (This is
      // the roadmap-blanking bug, now the universal default.)
      return { ...state, loading: false, error: action.error };
  }
}

const INITIAL: PublicResource<never> = {
  data: null,
  loading: true,
  error: null,
};

/**
 * The SDK's one GET-into-state hook. Fetches on mount and whenever `deps`
 * change, drops a resolved fetch after unmount, and turns any failure into one
 * `error` string — so every read surface handles loading and errors the same
 * way instead of each hook rolling its own `active` flag and `.catch`.
 *
 * `deps` is the caller's refetch trigger (e.g. `[client, reloadKey]`,
 * `[client, id]`): the effect re-runs exactly when they change, NOT on
 * `fetcher`'s identity, so a caller can pass an inline arrow without causing a
 * refetch every render.
 *
 * Never clears `data` on failure — see the reducer. Surfaces that shouldn't
 * show an error (the toast, the launcher badge, Home's trending) simply read
 * `{ data, loading }` and leave `error` alone; it's captured, not swallowed.
 */
export function usePublicResource<T>(
  fetcher: (client: FeedockClient) => Promise<T>,
  deps: DependencyList,
): PublicResource<T> {
  const { client } = useFeedockContext();
  const [state, dispatch] = useReducer(
    resourceReducer<T>,
    INITIAL as PublicResource<T>,
  );

  useEffect(() => {
    let active = true;
    dispatch({ type: RESOURCE_ACTION.Loading });
    fetcher(client)
      .then((data) => {
        if (active) {
          dispatch({ type: RESOURCE_ACTION.Loaded, data });
        }
      })
      .catch((e: unknown) => {
        if (active) {
          dispatch({
            type: RESOURCE_ACTION.Failed,
            error: e instanceof Error ? e.message : "Failed to load.",
          });
        }
      });
    return () => {
      active = false;
    };
    // The caller's `deps` ARE the refetch contract. `fetcher` and `client` are
    // deliberately excluded: `fetcher` is a fresh arrow each render (including
    // it refetches every render), and `client` already lives in the caller's
    // deps where it matters. This is the one place that judgment is correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
