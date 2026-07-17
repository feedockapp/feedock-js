/**
 * Per-project "last seen update" persistence (localStorage). Shared by the
 * `<LatestUpdate>` toast and the launcher's unread badge so they never drift —
 * dismissing one marks the update seen for both.
 */
/** Internal: the localStorage key for a project's last-seen update id. */
const seenUpdateKey = (slug: string): string => `feedock:${slug}:seen-update`;

/**
 * Readers to notify on a write. The `storage` event only reaches OTHER tabs, so
 * a tab that writes hears nothing about its own change — which is precisely the
 * case here, since the toast and the badge live in the same one. Without this
 * the two read the key at different moments and disagree: dismissing the toast
 * used to leave the badge lit until the next remount.
 */
const listeners = new Set<() => void>();

/** Subscribe to last-seen changes. Returns an unsubscribe. */
export function subscribeSeenUpdate(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readSeenUpdate(slug: string): string | null {
  try {
    return window.localStorage.getItem(seenUpdateKey(slug));
  } catch {
    return null;
  }
}

export function writeSeenUpdate(slug: string, id: string): void {
  try {
    window.localStorage.setItem(seenUpdateKey(slug), id);
  } catch {
    // Non-persistent (private mode / blocked storage) is acceptable.
  }
  // Announced even if the write threw: with storage blocked the value lives only
  // in this session, and the toast and badge must still agree within it.
  for (const listener of listeners) {
    listener();
  }
}
