/** Display formatting helpers shared across the SDK's components. */

const LONG_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};

const SHORT_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
};

/**
 * How much of a date to show. `Short` drops the year for trailing meta that has
 * to stay narrow (a roadmap card's ship date, a Home row); `Long` carries it for
 * anything a reader might date-stamp (a changelog byline, the roadmap detail).
 */
export const DATE_STYLE = {
  Long: "long",
  Short: "short",
} as const;

export type DateStyle = (typeof DATE_STYLE)[keyof typeof DATE_STYLE];

/**
 * The SDK's one date formatter.
 *
 * Always renders in the VISITOR's locale (`toLocaleDateString(undefined, …)`),
 * never a pinned one: this is an embedded widget on a founder's site and their
 * visitors are wherever they are. A German reader sees "5. Jan. 2026", a US
 * reader "Jan 5, 2026" — of the same instant.
 *
 * UPPERCASING IS NOT DONE HERE. Surfaces that want a shouty "APR 13" set
 * `textTransform: "uppercase"` in their style map, because case is presentation
 * and `String.toUpperCase()` on a localized month name is a locale bug waiting
 * to happen.
 *
 * An unparseable date yields "" — a blank beats "Invalid Date" in the UI.
 */
export function formatDate(
  iso: string,
  style: DateStyle = DATE_STYLE.Long,
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString(
    undefined,
    style === DATE_STYLE.Long ? LONG_OPTIONS : SHORT_OPTIONS,
  );
}

/**
 * Count + noun, auto-pluralized: `plural(1, "person", "people")` → "1 person",
 * `plural(3, "vote")` → "3 votes". Pass `many` for irregular plurals.
 */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * A file size in the largest unit that stays short: "500 B" / "2 KB" / "3.3 MB".
 * Binary units (1 KB = 1024 B), rounded to whole KB and one decimal MB.
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${Math.round(kb)} KB`;
  }
  const mb = kb / 1024;
  if (mb < 1024) {
    return `${mb.toFixed(1)} MB`;
  }
  // Without this a multi-GB file read as e.g. "3072.0 MB".
  return `${(mb / 1024).toFixed(1)} GB`;
}
