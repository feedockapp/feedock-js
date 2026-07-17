"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import { useFeedockContext } from "../../context";
import type { PublicUpdate } from "../../types";

export type UseChangelog = {
  items: PublicUpdate[];
  loading: boolean;
  error: string | null;
  /** More pages exist beyond what's loaded. */
  hasMore: boolean;
  /** A "load more" page is being fetched. */
  loadingMore: boolean;
  /** Fetch the next page and append it. */
  loadMore: () => void;
};

type State = {
  items: PublicUpdate[];
  cursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
};

/** Reducer action tags, named so the switch and the dispatches can't drift. */
const CHANGELOG_ACTION = {
  Loading: "loading",
  Loaded: "loaded",
  LoadMoreStart: "load-more-start",
  Appended: "appended",
  Failed: "failed",
} as const;

type Action =
  | { type: typeof CHANGELOG_ACTION.Loading }
  | {
      type: typeof CHANGELOG_ACTION.Loaded;
      items: PublicUpdate[];
      cursor: string | null;
    }
  | { type: typeof CHANGELOG_ACTION.LoadMoreStart }
  | {
      type: typeof CHANGELOG_ACTION.Appended;
      items: PublicUpdate[];
      cursor: string | null;
    }
  | { type: typeof CHANGELOG_ACTION.Failed; error: string };

const INITIAL: State = {
  items: [],
  cursor: null,
  loading: true,
  loadingMore: false,
  error: null,
};

function changelogReducer(state: State, action: Action): State {
  switch (action.type) {
    case CHANGELOG_ACTION.Loading:
      return { ...state, loading: true, error: null };
    case CHANGELOG_ACTION.Loaded:
      return {
        items: action.items,
        cursor: action.cursor,
        loading: false,
        loadingMore: false,
        error: null,
      };
    case CHANGELOG_ACTION.LoadMoreStart:
      return { ...state, loadingMore: true, error: null };
    case CHANGELOG_ACTION.Appended:
      return {
        ...state,
        items: [...state.items, ...action.items],
        cursor: action.cursor,
        loadingMore: false,
      };
    case CHANGELOG_ACTION.Failed:
      // Keep what's on screen — a failed first page or "load more" shouldn't
      // blank a changelog the visitor is already reading.
      return {
        ...state,
        loading: false,
        loadingMore: false,
        error: action.error,
      };
  }
}

/**
 * Fetch published updates for the `<Changelog>` surface, paged with a keyset
 * cursor. Keeps the current entries on a failed (re)fetch, so a transient
 * failure on a widget re-open doesn't blank the list.
 */
export function useChangelog(reloadKey = 0): UseChangelog {
  const { client } = useFeedockContext();
  const [state, dispatch] = useReducer(changelogReducer, INITIAL);

  // Bumped on every first-page load; a "load more" drops its result if the list
  // was reset under it (see use-feedback-board for the same guard).
  const generation = useRef(0);

  useEffect(() => {
    let active = true;
    generation.current += 1;
    dispatch({ type: CHANGELOG_ACTION.Loading });
    client
      .listUpdates()
      .then((page) => {
        if (active) {
          dispatch({
            type: CHANGELOG_ACTION.Loaded,
            items: page.items,
            cursor: page.nextCursor,
          });
        }
      })
      .catch((e: unknown) => {
        if (active) {
          dispatch({
            type: CHANGELOG_ACTION.Failed,
            error: e instanceof Error ? e.message : "Failed to load.",
          });
        }
      });
    return () => {
      active = false;
    };
    // `reloadKey` bumps when the host re-opens the widget — refetch fresh data.
  }, [client, reloadKey]);

  const loadMore = useCallback(() => {
    if (state.loadingMore || state.cursor === null) {
      return;
    }
    const myGen = generation.current;
    dispatch({ type: CHANGELOG_ACTION.LoadMoreStart });
    client
      .listUpdates(state.cursor)
      .then((page) => {
        if (myGen === generation.current) {
          dispatch({
            type: CHANGELOG_ACTION.Appended,
            items: page.items,
            cursor: page.nextCursor,
          });
        }
      })
      .catch((e: unknown) => {
        if (myGen === generation.current) {
          dispatch({
            type: CHANGELOG_ACTION.Failed,
            error: e instanceof Error ? e.message : "Failed to load.",
          });
        }
      });
  }, [client, state.cursor, state.loadingMore]);

  return useMemo(
    () => ({
      items: state.items,
      loading: state.loading,
      error: state.error,
      hasMore: state.cursor !== null,
      loadingMore: state.loadingMore,
      loadMore,
    }),
    [
      state.items,
      state.loading,
      state.error,
      state.cursor,
      state.loadingMore,
      loadMore,
    ],
  );
}
