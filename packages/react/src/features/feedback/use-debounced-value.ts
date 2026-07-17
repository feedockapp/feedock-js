"use client";

import { useEffect, useState } from "react";

/**
 * `value`, but it only catches up after `delayMs` of quiet.
 *
 * A real timer with a real cleanup — a correct effect, it was just living in the
 * board component's body. The cleanup is what makes it a debounce rather than a
 * pile of pending timers: each new `value` clears the previous timer before
 * arming its own, so a fast typist queues exactly one trailing update.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
