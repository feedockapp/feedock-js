"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useFeedockContext } from "../../context";
import { readSeenUpdate, writeSeenUpdate } from "./seen";
import type { PublicUpdate } from "../../types";

/** Matches the toast's CSS fade-out, so `gone` flips after it has left. */
const FADE_OUT_MS = 260;

type UseLatestUpdate = {
  /** The newest published update to show, or null when there's nothing new. */
  update: PublicUpdate | null;
  /** Drives the fade/slide-in transition (false until the toast should appear). */
  visible: boolean;
  /** True once dismissed — the caller unmounts the toast. */
  gone: boolean;
  /** Mark the newest update as seen (so it won't reappear until a newer one). */
  markSeen: () => void;
  /** Fade out, mark seen, then flag `gone` after the transition. */
  dismiss: () => void;
};

/**
 * "Last seen update" gating for `<LatestUpdate>`: fetches the newest published
 * update and only surfaces it when it's newer than the one this visitor last saw
 * (persisted per project in localStorage). Dismissing or opening marks it seen.
 */
export function useLatestUpdate(): UseLatestUpdate {
  const { client, slug } = useFeedockContext();
  const [update, setUpdate] = useState<PublicUpdate | null>(null);
  const [visible, setVisible] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    let active = true;
    client
      .listUpdates()
      .then((page) => {
        if (!active) {
          return;
        }
        const latest = page.items[0];
        if (!latest) {
          return;
        }
        if (readSeenUpdate(slug) === latest.id) {
          return;
        }
        setUpdate(latest);
        requestAnimationFrame(() => active && setVisible(true));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [client, slug]);

  const markSeen = useCallback(() => {
    if (update) {
      writeSeenUpdate(slug, update.id);
    }
  }, [update, slug]);

  // The timeout outlives the fade so `gone` flips only once the toast has
  // finished animating out; unmounting first just drops a harmless no-op set.
  const dismiss = useCallback(() => {
    setVisible(false);
    markSeen();
    window.setTimeout(() => setGone(true), FADE_OUT_MS);
  }, [markSeen]);

  return useMemo(
    () => ({ update, visible, gone, markSeen, dismiss }),
    [update, visible, gone, markSeen, dismiss],
  );
}
