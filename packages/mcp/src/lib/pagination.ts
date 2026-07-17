/**
 * Pagination helpers (docs/features/mcp-server.md §5 + §5.3).
 *
 * The dashboard list resolvers are **row-capped** at `MAX_LIST_ROWS` (= 200) but
 * are **not** cursor-paginated and take **no `limit`/`take` argument** — the
 * client can't overfetch. So:
 *
 *  - The tool `limit` is **display-only client-side slicing** of the capped page;
 *    {@link clampLimit} bounds it to 1..200.
 *  - {@link atCap} is the only honest "more may exist" signal: `rows.length ===
 *    MAX_LIST_ROWS` — a **lower bound** (`mayBeTruncated`), it cannot distinguish
 *    "exactly 200" from "clipped". A precise flag needs the resolver to overfetch
 *    `MAX_LIST_ROWS + 1` (an API change tracked in §5.2). v1 uses this form.
 */

/** Server-side hard cap on every dashboard list (apps/api pagination.constants). */
export const MAX_LIST_ROWS = 200;

/** Default page size a list tool slices to when the caller omits `limit`. */
export const DEFAULT_LIMIT = 50;

/** Clamp a requested limit into the valid 1..MAX_LIST_ROWS window. */
export function clampLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || Number.isNaN(limit)) {
    return DEFAULT_LIMIT;
  }
  return Math.min(MAX_LIST_ROWS, Math.max(1, Math.floor(limit)));
}

/**
 * Lower-bound truncation signal: true when the API returned exactly its cap, so
 * more rows *may* exist beyond what was fetched (it can't prove clipping).
 */
export function atCap(rowCount: number): boolean {
  return rowCount >= MAX_LIST_ROWS;
}

/**
 * Project a capped page into a tool result: slice to the client `limit` and
 * compute `atCap` over the **full** fetched page (not the slice), so the flag
 * still reflects the API cap even when the caller narrows the view.
 *
 * `sourceLength` overrides the row count `atCap` is computed from. Pass it when
 * `rows` is a **client-side-filtered** subset of the API page: the API caps
 * **before** the filter, so `atCap` must reflect the unfiltered page length, not
 * the (smaller) filtered one — otherwise a filter that drops rows below the cap
 * would falsely report the page as complete (§5).
 */
export function paginate<T>(
  rows: readonly T[],
  limit: number | undefined,
  sourceLength?: number,
): { items: T[]; atCap: boolean } {
  const flag = atCap(sourceLength ?? rows.length);
  const items = rows.slice(0, clampLimit(limit));
  return { items, atCap: flag };
}
