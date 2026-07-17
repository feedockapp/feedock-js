"use client";

import { useCallback, useEffect, useReducer, useState } from "react";

import { useFeedockContext, type VisitorIdentity } from "../../context";
import type { PublicFeedbackListItem } from "../../types";

type Sort = "top" | "new";

type Gate = { action: string; run: (identity: VisitorIdentity) => void } | null;

type FeedbackListState = {
  items: PublicFeedbackListItem[];
  loading: boolean;
  error: string | null;
};

type FeedbackListAction =
  | { type: "loading" }
  | { type: "loaded"; items: PublicFeedbackListItem[] }
  | { type: "failed"; error: string }
  | { type: "vote-count"; id: string; voteCount: number }
  | { type: "submitted"; item: PublicFeedbackListItem };

function feedbackListReducer(
  state: FeedbackListState,
  action: FeedbackListAction,
): FeedbackListState {
  switch (action.type) {
    case "loading":
      return { ...state, loading: true, error: null };
    case "loaded":
      return { items: action.items, loading: false, error: null };
    case "failed":
      return { ...state, loading: false, error: action.error };
    case "vote-count":
      return {
        ...state,
        error: null,
        items: state.items.map((it) =>
          it.id === action.id ? { ...it, voteCount: action.voteCount } : it,
        ),
      };
    case "submitted":
      return { ...state, error: null, items: [action.item, ...state.items] };
  }
}

export type UseFeedbackBoard = {
  items: PublicFeedbackListItem[];
  sort: Sort;
  setSort: (sort: Sort) => void;
  loading: boolean;
  error: string | null;
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
 * Loads the public feedback list (refetching on sort change), and gates every
 * write behind the one-time email verification — running the pending action with
 * the fresh token once the visitor verifies.
 */
export function useFeedbackBoard(
  defaultSort: Sort,
  query = "",
  reloadKey = 0,
): UseFeedbackBoard {
  const { client, identity, ensureIdentity } = useFeedockContext();
  const [list, dispatchList] = useReducer(feedbackListReducer, {
    items: [],
    loading: true,
    error: null,
  });
  const [sort, setSort] = useState<Sort>(defaultSort);
  const [composerOpen, setComposerOpen] = useState(false);
  const [gate, setGate] = useState<Gate>(null);

  const q = query.trim();
  useEffect(() => {
    let active = true;
    dispatchList({ type: "loading" });
    // A search hits the server (it can't be a page-1-only client filter) — the
    // API returns matches across all pages, allowlisted + keyset-paginated.
    client
      .listFeedback({ sort, q: q || undefined })
      .then((page) => {
        if (active) {
          dispatchList({ type: "loaded", items: page.items });
        }
      })
      .catch((e: unknown) => {
        if (active) {
          dispatchList({
            type: "failed",
            error: e instanceof Error ? e.message : "Failed to load.",
          });
        }
      });
    return () => {
      active = false;
    };
    // `reloadKey` bumps when the host re-opens the widget — refetch fresh data.
  }, [client, sort, q, reloadKey]);

  const doVote = useCallback(
    async (id: string, token: string) => {
      try {
        const result = await client.vote(token, id);
        dispatchList({ type: "vote-count", id, voteCount: result.voteCount });
      } catch (e) {
        dispatchList({
          type: "failed",
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

  const onVote = (id: string) =>
    guarded("vote", (id2) => doVote(id, id2.token));
  const onNewPost = () => guarded("post", () => setComposerOpen(true));

  const applyVoteCount = useCallback(
    (id: string, voteCount: number) =>
      dispatchList({ type: "vote-count", id, voteCount }),
    [],
  );

  const onSubmitted = (item: PublicFeedbackListItem) => {
    dispatchList({ type: "submitted", item });
    setComposerOpen(false);
  };

  return {
    items: list.items,
    sort,
    setSort,
    loading: list.loading,
    error: list.error,
    composerOpen,
    setComposerOpen,
    gate,
    setGate,
    onVote,
    onNewPost,
    onSubmitted,
    guarded,
    applyVoteCount,
  };
}
