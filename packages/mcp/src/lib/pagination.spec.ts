/**
 * Pagination + `atCap` (docs/features/mcp-server.md §5.3, §5.2). The dashboard
 * lists are row-capped at `MAX_LIST_ROWS` (200) and take no `limit`/`take` arg,
 * so the client can't overfetch — the only honest "more may exist" signal is
 * `atCap = rows.length === MAX_LIST_ROWS`. The tool `limit` is display-only
 * client-side slicing of the capped page and must NOT change `atCap`.
 */

import { describe, expect, it } from "vitest";

import {
  atCap,
  clampLimit,
  DEFAULT_LIMIT,
  MAX_LIST_ROWS,
  paginate,
} from "./pagination.js";

const rows = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

describe("atCap", () => {
  it("is false below the cap", () => {
    expect(atCap(0)).toBe(false);
    expect(atCap(MAX_LIST_ROWS - 1)).toBe(false);
  });

  it("is true exactly at the cap (lower-bound truncation signal)", () => {
    expect(atCap(MAX_LIST_ROWS)).toBe(true);
  });

  it("is true above the cap (defensive — overfetch case)", () => {
    expect(atCap(MAX_LIST_ROWS + 1)).toBe(true);
  });
});

describe("clampLimit", () => {
  it("defaults when limit is missing/NaN", () => {
    expect(clampLimit(undefined)).toBe(DEFAULT_LIMIT);
    expect(clampLimit(Number.NaN)).toBe(DEFAULT_LIMIT);
  });

  it("clamps into 1..MAX_LIST_ROWS and floors fractions", () => {
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(-5)).toBe(1);
    expect(clampLimit(5.9)).toBe(5);
    expect(clampLimit(10_000)).toBe(MAX_LIST_ROWS);
  });
});

describe("paginate", () => {
  it("sets atCap = rows.length === MAX_LIST_ROWS over the FULL page, not the slice", () => {
    const full = paginate(rows(MAX_LIST_ROWS), 10);
    expect(full.atCap).toBe(true); // 200 rows fetched → may be clipped
    expect(full.items).toHaveLength(10); // slice is display-only
  });

  it("does not flag atCap for a short page", () => {
    const page = paginate(rows(42), 50);
    expect(page.atCap).toBe(false);
    expect(page.items).toHaveLength(42);
  });

  it("slicing the page never flips atCap (limit is unrelated to the cap)", () => {
    const page = paginate(rows(MAX_LIST_ROWS), 1);
    expect(page.items).toHaveLength(1);
    expect(page.atCap).toBe(true);
  });
});
