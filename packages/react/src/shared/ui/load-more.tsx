"use client";

import { useState } from "react";

import { useStyles } from "../lib/use-styles";
import { loadMoreStyles } from "./load-more-styles";
import { Spinner } from "./spinner";

type Props = {
  /** Fetch the next page. */
  onClick: () => void;
  /** A page is in flight — the button shows a spinner and is disabled. */
  loading: boolean;
  label?: string;
};

/**
 * A centered "Load more" control for a cursor-paginated list. Rendered by the
 * caller only when there IS a next page, so it never sits inert at the end.
 */
export function LoadMore({ onClick, loading, label = "Load more" }: Props) {
  const styles = useStyles(loadMoreStyles);
  const [hover, setHover] = useState(false);
  return (
    <div style={styles.wrap}>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={styles.button(hover, loading)}
      >
        {loading ? <Spinner size={13} /> : null}
        {loading ? "Loading…" : label}
      </button>
    </div>
  );
}
