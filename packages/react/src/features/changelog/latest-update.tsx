"use client";

import { useState } from "react";

import { useLatestUpdate } from "./use-latest-update";
import { toExcerpt } from "./latest-update-text";
import { latestUpdateStyles } from "./latest-update-styles";
import { useStyles } from "../../shared/lib/use-styles";

export type Props = {
  /** Called when the user clicks the action (e.g. open the full "What's New"). */
  onOpen?: () => void;
  /** Max characters of the body excerpt (when there's no "why it matters" line). */
  excerptLength?: number;
};

/**
 * A dismissible "What's New" announcement. Renders the newest PUBLISHED update
 * (title + excerpt) only when it's newer than the one this visitor last saw
 * (persisted per project in localStorage). Fades in on appear; closing or
 * opening marks it seen so it won't reappear until there's a newer update.
 *
 * Self-contained inline styles + a CSS opacity/transform transition (no
 * animation dependency). Long titles/bodies clamp to two lines.
 */
export function LatestUpdate({ onOpen, excerptLength = 140 }: Props) {
  // `styles` is a hook, so it has to resolve above the early return below.
  const styles = useStyles(latestUpdateStyles);
  const { update, visible, gone, markSeen, dismiss } = useLatestUpdate();
  const [ctaHover, setCtaHover] = useState(false);
  const [closeHover, setCloseHover] = useState(false);

  if (!update || gone) {
    return null;
  }

  const excerpt = update.whyItMatters || toExcerpt(update.body, excerptLength);

  return (
    <section
      aria-live="polite"
      aria-label={`New update: ${update.title}`}
      style={styles.card(visible)}
    >
      {/* Title carries the top row now that the eyebrow is gone; the dismiss
          button rides alongside it. */}
      <div style={styles.header}>
        <h3 style={styles.title}>{update.title}</h3>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={dismiss}
          onMouseEnter={() => setCloseHover(true)}
          onMouseLeave={() => setCloseHover(false)}
          style={styles.closeButton(closeHover)}
        >
          ✕
        </button>
      </div>

      {excerpt ? <p style={styles.excerpt}>{excerpt}</p> : null}

      {onOpen ? (
        <button
          type="button"
          onClick={() => {
            markSeen();
            onOpen();
          }}
          onMouseEnter={() => setCtaHover(true)}
          onMouseLeave={() => setCtaHover(false)}
          style={styles.cta(ctaHover)}
        >
          See what’s new
          <span aria-hidden style={styles.ctaArrow(ctaHover)}>
            →
          </span>
        </button>
      ) : null}
    </section>
  );
}
