"use client";

import { useState } from "react";

import { useDetailSelection } from "../../shared/hooks/use-detail-selection";
import { useStyles } from "../../shared/lib/use-styles";
import { IdentityPrompt, SubmitForm } from "../submit";
import { ClockIcon, SearchIcon, TrendingIcon } from "./feedback-board-icons";
import { FeedbackBoardList } from "./feedback-board-list";
import { feedbackBoardStyles } from "./feedback-board-styles";
import { FeedbackDetail } from "./feedback-detail";
import { useDebouncedValue } from "./use-debounced-value";
import { useFeedbackBoard } from "./use-feedback-board";

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

/** Keystrokes settle for this long before the search hits the server. */
const SEARCH_DEBOUNCE_MS = 300;

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
  const styles = useStyles(feedbackBoardStyles);
  // The host protocol — deep-link open, collapse, and the open/close notify the
  // widget's Back button depends on. See shared/hooks/use-detail-selection.
  const { selectedId, select, close } = useDetailSelection({
    openItemId,
    openItemNonce,
    collapseNonce,
    onDetailOpenChange,
  });
  const [search, setSearch] = useState("");
  // Header interaction state (hover on search + sort pills, search focus).
  const [searchHover, setSearchHover] = useState(false);
  const [searchFocus, setSearchFocus] = useState(false);
  const [hoveredSort, setHoveredSort] = useState<"top" | "new" | null>(null);
  // Don't query the server on every keystroke.
  const debounced = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

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
    <div style={styles.headerRow}>
      <div style={styles.searchWrap}>
        <span style={styles.searchIcon}>
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
          style={styles.searchInput(searchHover, searchFocus)}
        />
      </div>

      <div style={styles.sortGroup}>
        <button
          type="button"
          style={styles.sortItem(sort === "top", hoveredSort === "top")}
          onClick={() => setSort("top")}
          onMouseEnter={() => setHoveredSort("top")}
          onMouseLeave={() => setHoveredSort((h) => (h === "top" ? null : h))}
        >
          <TrendingIcon />
          Top
        </button>
        <button
          type="button"
          style={styles.sortItem(sort === "new", hoveredSort === "new")}
          onClick={() => setSort("new")}
          onMouseEnter={() => setHoveredSort("new")}
          onMouseLeave={() => setHoveredSort((h) => (h === "new" ? null : h))}
        >
          <ClockIcon />
          New
        </button>
      </div>

      {showSubmit ? (
        <button type="button" onClick={onNewPost} style={styles.newPost}>
          New post
        </button>
      ) : null}
    </div>
  );

  const composerEl = composerOpen ? (
    <SubmitForm
      onSubmitted={onSubmitted}
      onCancel={() => setComposerOpen(false)}
    />
  ) : null;
  const errorEl = error ? <div style={styles.error}>{error}</div> : null;
  const listEl = (
    <FeedbackBoardList
      items={items}
      loading={loading}
      onVote={onVote}
      onSelect={select}
      searching={debounced.trim().length > 0}
    />
  );

  const detailEl = selectedId ? (
    <FeedbackDetail
      id={selectedId}
      onBack={close}
      guarded={guarded}
      onVoteCount={applyVoteCount}
      hideBack={hideDetailBack}
    />
  ) : null;

  return (
    <div style={styles.root(fill)}>
      {/* The identity gate pins to the top; the detail/list scroll below it. */}
      {gate ? (
        <div style={styles.gateSection(fill)}>
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
          <div style={styles.fillSection}>{detailEl}</div>
        ) : (
          detailEl
        )
      ) : fill ? (
        <>
          <div style={styles.headerSection}>
            {headerRow}
            {composerEl}
            {errorEl}
          </div>
          <div style={styles.listScroll}>{listEl}</div>
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
