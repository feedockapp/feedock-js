/** Display formatting helpers shared across the SDK's components. */

/** Localized "Jan 5, 2026" date from an ISO string. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Count + noun, auto-pluralized: `plural(1, "person", "people")` → "1 person",
 * `plural(3, "vote")` → "3 votes". Pass `many` for irregular plurals.
 */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
