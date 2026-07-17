"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type DetailSelectionArgs = {
  /** Deep-link target; opened when `openItemNonce` advances. */
  openItemId: string | null;
  /**
   * Advance to open `openItemId`. A nonce (not the id) is the trigger so
   * re-selecting the SAME item re-opens it, and so a remount never re-opens a
   * stale id.
   */
  openItemNonce: number;
  /** Advance to force-close any open detail (e.g. the host switched tabs). */
  collapseNonce: number;
  /** Fired on each open/close transition — the host resizes + restores origin. */
  onDetailOpenChange?: (open: boolean) => void;
};

export type DetailSelection = {
  /** The open item's id, or null when the list is showing. */
  selectedId: string | null;
  /** Open an item's detail. Stable — safe as a memoized child's prop. */
  select: (id: string) => void;
  /** Back to the list. Stable — safe as a memoized child's prop. */
  close: () => void;
};

/**
 * The host protocol every board surface (<FeedbackBoard> / <Roadmap> /
 * <Changelog>) shares: which item's detail is open, the two nonces the host
 * drives it with, and the open/close notification back to the host.
 *
 * All three carried a byte-identical copy of this; it lives here once.
 */
export function useDetailSelection({
  openItemId,
  openItemNonce,
  collapseNonce,
  onDetailOpenChange,
}: DetailSelectionArgs): DetailSelection {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ---- nonce -> state, adjusted during render (NOT an effect) ----
  //
  // Both of these are React's documented "adjusting state when a prop changes":
  // we compare the prop against the value we last saw and set state right here
  // in the render body. React discards this render and immediately re-runs the
  // component with the new state — before touching the DOM — so the detail opens
  // and closes in ONE commit. As effects (what these used to be) each one cost a
  // second render *after* paint, which is a visible frame of the wrong view.
  // Setting our OWN state during our OWN render is legal; setting the host's is
  // not, which is exactly why the notification below has to stay an effect.
  const [lastOpenNonce, setLastOpenNonce] = useState(openItemNonce);
  if (openItemNonce !== lastOpenNonce) {
    setLastOpenNonce(openItemNonce);
    if (openItemId) {
      setSelectedId(openItemId);
    }
  }

  // Order matters and matches the effects this replaced: when a host bumps both
  // nonces in one commit, collapse runs last and wins (lands on the list).
  const [lastCollapse, setLastCollapse] = useState(collapseNonce);
  if (collapseNonce !== lastCollapse) {
    setLastCollapse(collapseNonce);
    setSelectedId(null);
  }

  // ---- notify the host (KEEP THIS EFFECT) ----
  //
  // This reads like a textbook removable notify-the-parent effect. It is not.
  // Deleting it typechecks, passes lint, and silently breaks the widget's Back
  // button. Verified in packages/widget/src/widget.tsx: the panel header's
  // `onBack` ONLY does `setCollapseNonce((n) => n + 1)`. The widget's own
  // `detailOpen` — which drives the header's "← Back" swap, the panel resize,
  // AND the deep-link return-to-origin-tab — flips back SOLELY because we call
  // `onDetailOpenChange(false)` here.
  //
  // It cannot move into an event handler: the close is PROP-driven (the host
  // bumps collapseNonce), so there is no handler of ours to put it in. It cannot
  // move into the render body above: that would set the HOST's state during OUR
  // render, which React rejects. An effect is the correct and only tool.
  //
  // The ref sentinel keeps it to one call per real transition — `onDetailOpenChange`
  // is an inline arrow in the widget, so this effect re-runs on every host
  // render and must no-op unless the open/closed value actually changed.
  const detailWasOpen = useRef(false);
  useEffect(() => {
    const isOpen = selectedId !== null;
    if (isOpen !== detailWasOpen.current) {
      detailWasOpen.current = isOpen;
      onDetailOpenChange?.(isOpen);
    }
  }, [selectedId, onDetailOpenChange]);

  const select = useCallback((id: string) => setSelectedId(id), []);
  const close = useCallback(() => setSelectedId(null), []);

  return useMemo(
    () => ({ selectedId, select, close }),
    [selectedId, select, close],
  );
}
