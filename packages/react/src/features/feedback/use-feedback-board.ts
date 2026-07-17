"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import { useFeedockContext, type VisitorIdentity } from "../../context";
import type { PublicFeedbackListItem } from "../../types";

type Sort = "top" | "new";

type Gate = { action: string; run: (identity: VisitorIdentity) => void } | null;

type FeedbackListState = {
  items: PublicFeedbackListItem[];
  /** Keyset cursor for the NEXT page, or null when the list is exhausted. */
  cursor: string | null;
  loading: boolean;
  /** A "load more" page is in flight (distinct from the first-page `loading`). */
  loadingMore: boolean;
  error: string | null;
};

/** Reducer action tags, named so the switch and the dispatches can't drift. */
const FEEDBACK_LIST_ACTION = {
  Loading: "loading",
  Loaded: "loaded",
  LoadMoreStart: "load-more-start",
  Appended: "appended",
  Failed: "failed",
  VoteCount: "vote-count",
  Submitted: "submitted",
} as const;

type FeedbackListAction =
  | { type: typeof FEEDBACK_LIST_ACTION.Loading }
  | {
      type: typeof FEEDBACK_LIST_ACTION.Loaded;
      items: PublicFeedbackListItem[];
      cursor: string | null;
    }
  | { type: typeof FEEDBACK_LIST_ACTION.LoadMoreStart }
  | {
      type: typeof FEEDBACK_LIST_ACTION.Appended;
      items: PublicFeedbackListItem[];
      cursor: string | null;
    }
  | { type: typeof FEEDBACK_LIST_ACTION.Failed; error: string }
  | {
      type: typeof FEEDBACK_LIST_ACTION.VoteCount;
      id: string;
      voteCount: number;
    }
  | {
      type: typeof FEEDBACK_LIST_ACTION.Submitted;
      item: PublicFeedbackListItem;
    };

const INITIAL: FeedbackListState = {
  items: [],
  cursor: null,
  loading: true,
  loadingMore: false,
  error: null,
};

function feedbackListReducer(
  state: FeedbackListState,
  action: FeedbackListAction,
): FeedbackListState {
  switch (action.type) {
    case FEEDBACK_LIST_ACTION.Loading:
      return { ...state, loading: true, error: null };
    case FEEDBACK_LIST_ACTION.Loaded:
      return {
        items: action.items,
        cursor: action.cursor,
        loading: false,
        loadingMore: false,
        error: null,
      };
    case FEEDBACK_LIST_ACTION.LoadMoreStart:
      return { ...state, loadingMore: true, error: null };
    case FEEDBACK_LIST_ACTION.Appended:
      return {
        ...state,
        items: [...state.items, ...action.items],
        cursor: action.cursor,
        loadingMore: false,
      };
    case FEEDBACK_LIST_ACTION.Failed:
      // Keep whatever's on screen; a failed first page or "load more" shouldn't
      // blank the list. Clear both in-flight flags.
      return {
        ...state,
        loading: false,
        loadingMore: false,
        error: action.error,
      };
    case FEEDBACK_LIST_ACTION.VoteCount:
      return {
        ...state,
        error: null,
        items: state.items.map((it) =>
          it.id === action.id ? { ...it, voteCount: action.voteCount } : it,
        ),
      };
    case FEEDBACK_LIST_ACTION.Submitted:
      return { ...state, error: null, items: [action.item, ...state.items] };
  }
}

export type UseFeedbackBoard = {
  items: PublicFeedbackListItem[];
  sort: Sort;
  setSort: (sort: Sort) => void;
  loading: boolean;
  error: string | null;
  /** More pages exist beyond what's loaded. */
  hasMore: boolean;
  /** A "load more" page is being fetched. */
  loadingMore: boolean;
  /** Fetch the next page and append it. */
  loadMore: () => void;
  composerOpen: boolean;
  setComposerOpen: (open: boolean) => void;
  gate: Gate;
  setGate: (gate: Gate) => void;
  onVote: (id: string) => void;
  onNewPost: () => void;
  /** Prepend a freshly-posted item and close the composer. */
  onSubmitted: (item: PublicFeedbackListItem) => void;
  /** Run a write behind the identity gate (shared with the detail view). */
  guarded: (action: string, run: (identity: VisitorIdentity) => void) => void;
  /** Apply a vote count from elsewhere (e.g. the detail view) into the list. */
  applyVoteCount: (id: string, voteCount: number) => void;
};

/**
 * List-fetch + identity-gated upvote/submit orchestration for `<FeedbackBoard>`.
 * Loads the public feedback list (refetching on sort change), pages through it
 * with a keyset cursor, and gates every write behind the one-time email
 * verification — running the pending action with the fresh token once verified.
 */
export function useFeedbackBoard(
  defaultSort: Sort,
  query = "",
  reloadKey = 0,
): UseFeedbackBoard {
  const { client, identity, ensureIdentity } = useFeedockContext();
  const [list, dispatchList] = useReducer(feedbackListReducer, INITIAL);
  const [sort, setSort] = useState<Sort>(defaultSort);
  const [composerOpen, setComposerOpen] = useState(false);
  const [gate, setGate] = useState<Gate>(null);

  // Bumped on every first-page load (sort/query/reload change). A "load more"
  // captures the current value and drops its result if the list has since been
  // reset under it — so a slow page-2 from the old sort never appends to the new.
  const generation = useRef(0);

  const q = query.trim();
  useEffect(() => {
    let active = true;
    // Invalidate any in-flight "load more" from the previous sort/query.
    generation.current += 1;
    dispatchList({ type: FEEDBACK_LIST_ACTION.Loading });
    // A search hits the server (it can't be a page-1-only client filter) — the
    // API returns matches across all pages, allowlisted + keyset-paginated.
    client
      .listFeedback({ sort, q: q || undefined })
      .then((page) => {
        if (active) {
          dispatchList({
            type: FEEDBACK_LIST_ACTION.Loaded,
            items: page.items,
            cursor: page.nextCursor,
          });
        }
      })
      .catch((e: unknown) => {
        if (active) {
          dispatchList({
            type: FEEDBACK_LIST_ACTION.Failed,
            error: e instanceof Error ? e.message : "Failed to load.",
          });
        }
      });
    return () => {
      active = false;
    };
    // `reloadKey` bumps when the host re-opens the widget — refetch fresh data.
  }, [client, sort, q, reloadKey]);

  const loadMore = useCallback(() => {
    if (list.loadingMore || list.cursor === null) {
      return;
    }
    const myGen = generation.current;
    dispatchList({ type: FEEDBACK_LIST_ACTION.LoadMoreStart });
    client
      .listFeedback({ sort, q: q || undefined, cursor: list.cursor })
      .then((page) => {
        // Drop the page if the list was reset (sort/query change) mid-flight.
        if (myGen === generation.current) {
          dispatchList({
            type: FEEDBACK_LIST_ACTION.Appended,
            items: page.items,
            cursor: page.nextCursor,
          });
        }
      })
      .catch((e: unknown) => {
        if (myGen === generation.current) {
          dispatchList({
            type: FEEDBACK_LIST_ACTION.Failed,
            error: e instanceof Error ? e.message : "Failed to load.",
          });
        }
      });
  }, [client, sort, q, list.cursor, list.loadingMore]);

  const doVote = useCallback(
    async (id: string, token: string) => {
      try {
        const result = await client.vote(token, id);
        dispatchList({
          type: FEEDBACK_LIST_ACTION.VoteCount,
          id,
          voteCount: result.voteCount,
        });
      } catch (e) {
        dispatchList({
          type: FEEDBACK_LIST_ACTION.Failed,
          error: e instanceof Error ? e.message : "Vote failed.",
        });
      }
    },
    [client],
  );

  // Run a write action, verifying the visitor first if needed. A signed-in host
  // user is recognized silently (auto-identify) before the email prompt shows;
  // only a true anonymous visitor sees the gate.
  const guarded = useCallback(
    (action: string, run: (identity: VisitorIdentity) => void) => {
      if (identity) {
        run(identity);
        return;
      }
      void ensureIdentity().then((resolved) => {
        if (resolved) {
          run(resolved);
        } else {
          setGate({ action, run });
        }
      });
    },
    [identity, ensureIdentity],
  );

  // Stable, so the list rows below can be memoized: every card gets this one
  // `onVote` and calls it with its own id (no per-row closure).
  const onVote = useCallback(
    (id: string) => guarded("vote", (identity) => doVote(id, identity.token)),
    [guarded, doVote],
  );

  const onNewPost = useCallback(
    () => guarded("post", () => setComposerOpen(true)),
    [guarded],
  );

  const applyVoteCount = useCallback(
    (id: string, voteCount: number) =>
      dispatchList({ type: FEEDBACK_LIST_ACTION.VoteCount, id, voteCount }),
    [],
  );

  const onSubmitted = useCallback((item: PublicFeedbackListItem) => {
    dispatchList({ type: FEEDBACK_LIST_ACTION.Submitted, item });
    setComposerOpen(false);
  }, []);

  return useMemo(
    () => ({
      items: list.items,
      sort,
      setSort,
      loading: list.loading,
      error: list.error,
      hasMore: list.cursor !== null,
      loadingMore: list.loadingMore,
      loadMore,
      composerOpen,
      setComposerOpen,
      gate,
      setGate,
      onVote,
      onNewPost,
      onSubmitted,
      guarded,
      applyVoteCount,
    }),
    [
      list.items,
      list.cursor,
      list.loadingMore,
      sort,
      list.loading,
      list.error,
      loadMore,
      composerOpen,
      gate,
      onVote,
      onNewPost,
      onSubmitted,
      guarded,
      applyVoteCount,
    ],
  );
}
