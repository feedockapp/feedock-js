import type { ReactNode } from "react";

/**
 * Home section-header glyphs — the same Hugeicons the product uses (Fire /
 * Loading03 / Megaphone01), inlined at a size that sits with the 11px uppercase
 * labels. Everything inherits color via `currentColor`.
 */
function SectionSvg({ children }: { children: ReactNode }) {
  return (
    <svg
      width={13}
      height={13}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** Fire — Trending. */
export function TrendingSectionIcon() {
  return (
    <SectionSvg>
      <path d="M13.8561 22C26.0783 19 19.2338 7 10.9227 2C9.9453 5.5 8.47838 6.5 5.54497 10C1.66121 14.6339 3.5895 20 8.96719 22C8.1524 21 6.04958 18.9008 7.5 16C8 15 9 14 8.5 12C9.47778 12.5 11.5 13 12 15.5C12.8148 14.5 13.6604 12.4 12.8783 10C19 14.5 16.5 19 13.8561 22Z" />
    </SectionSvg>
  );
}

/** Loading03 spinner — In progress. */
export function ProgressSectionIcon() {
  return (
    <SectionSvg>
      <path d="M12 3V6" />
      <path d="M12 18V21" />
      <path d="M21 12L18 12" />
      <path d="M6 12L3 12" />
      <path d="M18.3635 5.63672L16.2422 7.75804" />
      <path d="M7.75804 16.2422L5.63672 18.3635" />
      <path d="M18.3635 18.3635L16.2422 16.2422" />
      <path d="M7.75804 7.75804L5.63672 5.63672" />
    </SectionSvg>
  );
}

/** Megaphone01 — Updates. */
export function UpdatesSectionIcon() {
  return (
    <SectionSvg>
      <path d="M14.9263 2.91103L8.27352 6.10452C7.76151 6.35029 7.21443 6.41187 6.65675 6.28693C6.29177 6.20517 6.10926 6.16429 5.9623 6.14751C4.13743 5.93912 3 7.38342 3 9.04427V9.95573C3 11.6166 4.13743 13.0609 5.9623 12.8525C6.10926 12.8357 6.29178 12.7948 6.65675 12.7131C7.21443 12.5881 7.76151 12.6497 8.27352 12.8955L14.9263 16.089C16.4534 16.8221 17.217 17.1886 18.0684 16.9029C18.9197 16.6172 19.2119 16.0041 19.7964 14.778C21.4012 11.4112 21.4012 7.58885 19.7964 4.22196C19.2119 2.99586 18.9197 2.38281 18.0684 2.0971C17.217 1.8114 16.4534 2.17794 14.9263 2.91103Z" />
      <path d="M7.5 12.5V6.5" />
    </SectionSvg>
  );
}
