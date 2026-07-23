/**
 * Host-controllable typography.
 *
 * Every component styles itself with INLINE styles (no stylesheet — the widget
 * renders inside a Shadow DOM, see A-017). Inline pixel sizes made the panel's
 * type impossible for a host to change: custom properties inherit through a
 * shadow boundary, but they can't touch `style={{ fontSize: 14 }}`.
 *
 * So sizes go through {@link fs}, which resolves against a custom property the
 * host may set. One knob scales the whole panel:
 *
 * ```css
 * :root { --feedock-font-size: 16px; }
 * ```
 *
 * `calc()` against the base — NOT `em` — because these styles nest: `em` would
 * compound, so a small label inside a small row would shrink twice. And not
 * `rem`, which resolves against the HOST page's root and would leak their
 * typography in. Unset, the fallback reproduces the previous pixel sizes
 * exactly, so existing embeds and SDK consumers don't shift.
 */

/** The size every ratio below is expressed against. */
export const BASE_FONT_SIZE_PX = 14;

/** Host-settable base size for the panel's type. */
export const FONT_SIZE_VAR = "--feedock-font-size";

/** Host-settable font stack for the panel. */
export const FONT_FAMILY_VAR = "--feedock-font-family";

/** `--feedock-font-size` with its default — the base for {@link fs}. */
export const BASE_FONT_SIZE = `var(${FONT_SIZE_VAR}, ${BASE_FONT_SIZE_PX}px)`;

/**
 * A font size that scales with the host's `--feedock-font-size`.
 *
 * @param px the size in px at the default base (what the design was drawn at).
 */
export function fs(px: number): string {
  if (px === BASE_FONT_SIZE_PX) {
    return BASE_FONT_SIZE;
  }
  // Trim float noise (13/14 = 0.9285714…) so the emitted CSS stays readable.
  const ratio = Number((px / BASE_FONT_SIZE_PX).toFixed(4));
  return `calc(${BASE_FONT_SIZE} * ${ratio})`;
}
