"use client";

import { useEffect, useState } from "react";

import { useFeedockContext } from "../../context";
import { readSeenUpdate, writeSeenUpdate } from "./seen";
import type { PublicUpdate } from "../../types";

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

  function markSeen() {
    if (update) {
      writeSeenUpdate(slug, update.id);
    }
  }

  function dismiss() {
    setVisible(false);
    markSeen();
    window.setTimeout(() => setGone(true), 260);
  }

  return { update, visible, gone, markSeen, dismiss };
}
