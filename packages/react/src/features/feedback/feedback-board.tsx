"use client";

import { useEffect, useRef, useState } from "react";

import { useFeedockContext } from "../../context";
import { useFeedbackBoard } from "./use-feedback-board";
import {
  feedbackFillSectionStyle,
  feedbackHeaderSectionStyle,
  feedbackListScrollStyle,
  feedbackNewPostStyle,
  feedbackRootStyle,
  feedbackSearchIconStyle,
  feedbackSearchInputStyle,
  feedbackSearchWrapStyle,
  feedbackSortGroupStyle,
  feedbackSortItemStyle,
} from "./feedback-board-styles";
import { IdentityPrompt, SubmitForm } from "../submit";
import { ClockIcon, SearchIcon, TrendingIcon } from "./feedback-board-icons";
import { FeedbackBoardList } from "./feedback-board-list";
import { FeedbackDetail } from "./feedback-detail";

export interface FeedbackBoardProps {
  defaultSort?: "top" | "new";
  /** Show the "New post" composer entry point (default true). */
  showSubmit?: boolean;
  /**
   * Fill the parent's height and scroll ONLY the list — the search + sort header
   * stays pinned. For fixed-height panel embeds (the widget). Default `false`
   * keeps the self-sizing layout that grows with its content.
   */
  fill?: boolean;
  /**
   * Deep-link: open this item's detail. Paired with `openItemNonce` — the board
   * opens the item whenever the nonce *changes* (so re-selecting the same item
   * re-opens it), and never on mount, so a remount doesn't re-open a stale id.
   */
  openItemId?: string | null;
  openItemNonce?: number;
  /** Fired when the detail view opens/closes — the host can resize + restore origin. */
  onDetailOpenChange?: (open: boolean) => void;
  /** Advance to force-close any open detail (e.g. the host switched tabs). */
  collapseNonce?: number;
  /** Hide the detail's in-body back (the host renders its own — e.g. the widget). */
  hideDetailBack?: boolean;
  /** Bumped when the host re-opens the widget — refetch the list (fresh data). */
  reloadKey?: number;
}

/**
 * Embeddable feedback board: a searchable list of public feedback that
 * account-less visitors can upvote, open (a detail view with comments), and
 * post to — each write gated by a one-time email verification. Self-contained
 * (inline styles) so it drops into any React app without CSS setup.
 */
export function FeedbackBoard({
  defaultSort = "top",
  showSubmit = true,
  fill = false,
  openItemId = null,
  openItemNonce = 0,
  onDetailOpenChange,
  collapseNonce = 0,
  hideDetailBack,
  reloadKey = 0,
}: FeedbackBoardProps) {
  const { theme } = useFeedockContext();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Open a deep-linked item only when the nonce advances past what we saw at
  // mount — never on mount itself (a post-triggered remount must not re-open).
  const lastOpenNonce = useRef(openItemNonce);
  useEffect(() => {
    if (openItemNonce !== lastOpenNonce.current) {
      lastOpenNonce.current = openItemNonce;
      if (openItemId) {
        setSelectedId(openItemId);
      }
    }
  }, [openItemNonce, openItemId]);
  // Report detail open/close transitions to the host (once per change).
  const detailWasOpen = useRef(false);
  useEffect(() => {
    const isOpen = selectedId !== null;
    if (isOpen !== detailWasOpen.current) {
      detailWasOpen.current = isOpen;
      onDetailOpenChange?.(isOpen);
    }
  }, [selectedId, onDetailOpenChange]);
  // Host bumped collapseNonce (e.g. a tab switch) — close any open detail.
  const lastCollapse = useRef(collapseNonce);
  useEffect(() => {
    if (collapseNonce !== lastCollapse.current) {
      lastCollapse.current = collapseNonce;
      setSelectedId(null);
    }
  }, [collapseNonce]);
  const [search, setSearch] = useState("");
  // Header interaction state (hover on search + sort pills, search focus).
  const [searchHover, setSearchHover] = useState(false);
  const [searchFocus, setSearchFocus] = useState(false);
  const [hoveredSort, setHoveredSort] = useState<"top" | "new" | null>(null);
  // Debounce the search so the server isn't queried on every keystroke.
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const {
    items,
    sort,
    setSort,
    loading,
    error,
    composerOpen,
    setComposerOpen,
    gate,
    setGate,
    onVote,
    onNewPost,
    onSubmitted,
    guarded,
    applyVoteCount,
  } = useFeedbackBoard(defaultSort, debounced, reloadKey);

  const headerRow = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      <div style={feedbackSearchWrapStyle()}>
        <span style={feedbackSearchIconStyle(theme)}>
          <SearchIcon />
        </span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onMouseEnter={() => setSearchHover(true)}
          onMouseLeave={() => setSearchHover(false)}
          onFocus={() => setSearchFocus(true)}
          onBlur={() => setSearchFocus(false)}
          placeholder="Search feedback"
          aria-label="Search feedback"
          style={feedbackSearchInputStyle(theme, searchHover, searchFocus)}
        />
      </div>

      <div style={feedbackSortGroupStyle(theme)}>
        <button
          type="button"
          style={feedbackSortItemStyle(
            theme,
            sort === "top",
            hoveredSort === "top",
          )}
          onClick={() => setSort("top")}
          onMouseEnter={() => setHoveredSort("top")}
          onMouseLeave={() => setHoveredSort((h) => (h === "top" ? null : h))}
        >
          <TrendingIcon />
          Top
        </button>
        <button
          type="button"
          style={feedbackSortItemStyle(
            theme,
            sort === "new",
            hoveredSort === "new",
          )}
          onClick={() => setSort("new")}
          onMouseEnter={() => setHoveredSort("new")}
          onMouseLeave={() => setHoveredSort((h) => (h === "new" ? null : h))}
        >
          <ClockIcon />
          New
        </button>
      </div>

      {showSubmit ? (
        <button
          type="button"
          onClick={onNewPost}
          style={feedbackNewPostStyle(theme)}
        >
          New post
        </button>
      ) : null}
    </div>
  );

  const composerEl = composerOpen ? (
    <SubmitForm onSubmitted={onSubmitted} onCancel={() => setComposerOpen(false)} />
  ) : null;
  const errorEl = error ? (
    <div style={{ fontSize: 13, color: "#D33A3F" }}>{error}</div>
  ) : null;
  const listEl = (
    <FeedbackBoardList
      items={items}
      loading={loading}
      onVote={onVote}
      onSelect={setSelectedId}
    />
  );

  const detailEl = selectedId ? (
    <FeedbackDetail
      id={selectedId}
      onBack={() => setSelectedId(null)}
      guarded={guarded}
      onVoteCount={applyVoteCount}
      hideBack={hideDetailBack}
    />
  ) : null;

  return (
    <div style={feedbackRootStyle(theme, fill)}>
      {/* The identity gate pins to the top; the detail/list scroll below it. */}
      {gate ? (
        <div style={fill ? { padding: "16px 16px 0", flexShrink: 0 } : undefined}>
          <IdentityPrompt
            action={gate.action}
            onVerified={(verified) => {
              gate.run(verified);
              setGate(null);
            }}
            onCancel={() => setGate(null)}
          />
        </div>
      ) : null}

      {detailEl ? (
        fill ? (
          <div style={feedbackFillSectionStyle()}>{detailEl}</div>
        ) : (
          detailEl
        )
      ) : fill ? (
        <>
          <div style={feedbackHeaderSectionStyle()}>
            {headerRow}
            {composerEl}
            {errorEl}
          </div>
          <div style={feedbackListScrollStyle()}>{listEl}</div>
        </>
      ) : (
        <>
          {headerRow}
          {composerEl}
          {errorEl}
          {listEl}
        </>
      )}
    </div>
  );
}
