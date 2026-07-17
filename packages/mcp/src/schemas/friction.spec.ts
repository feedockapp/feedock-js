/**
 * Friction inputs (docs/features/mcp-server.md §5.1 + §5.3). The two sensitive
 * tools carry server-enforced friction expressed as zod input schemas:
 *
 *  - publish_changelog: `confirm:true` (literal) + `previewToken` matching the
 *    `"<issuedAt>.<mac>"` HMAC shape + `expectedFirstPublish` (must match the
 *    preview). Annotations are hints, not the guard — the schema is the first line.
 *  - merge_feedback: `confirm:true` (literal) + `expectedCanonicalTitle` (the
 *    race guard checked against the canonical before folding).
 *
 * We wrap each raw shape in `z.object` (the SDK does this internally) and assert
 * it REJECTS missing/invalid inputs and ACCEPTS a well-formed one.
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  MergeFeedbackInput,
  PREVIEW_TOKEN_PATTERN,
  PublishChangelogInput,
} from "./index.js";

const Publish = z.object(PublishChangelogInput);
const Merge = z.object(MergeFeedbackInput);

const ENTRY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CANON_ID = "bbbbbbbb-bbbb-4bbb-9bbb-bbbbbbbbbbbb";
const DUP_ID = "cccccccc-cccc-4ccc-accc-cccccccccccc";
const VALID_TOKEN = `1717171717171.${"a".repeat(64)}`;

describe("PublishChangelogInput (publish friction)", () => {
  it("accepts a well-formed input", () => {
    const parsed = Publish.parse({
      id: ENTRY_ID,
      confirm: true,
      previewToken: VALID_TOKEN,
      expectedFirstPublish: true,
    });
    expect(parsed.confirm).toBe(true);
    expect(parsed.previewToken).toBe(VALID_TOKEN);
  });

  it("rejects confirm:false (must be the literal true)", () => {
    expect(
      Publish.safeParse({
        id: ENTRY_ID,
        confirm: false,
        previewToken: VALID_TOKEN,
        expectedFirstPublish: true,
      }).success,
    ).toBe(false);
  });

  it("rejects a missing confirm", () => {
    expect(
      Publish.safeParse({
        id: ENTRY_ID,
        previewToken: VALID_TOKEN,
        expectedFirstPublish: true,
      }).success,
    ).toBe(false);
  });

  it("rejects a missing previewToken", () => {
    expect(
      Publish.safeParse({
        id: ENTRY_ID,
        confirm: true,
        expectedFirstPublish: true,
      }).success,
    ).toBe(false);
  });

  it("rejects a malformed previewToken (wrong shape — no mac / bad hex)", () => {
    for (const bad of [
      "not-a-token",
      "123.deadbeef", // mac too short
      `123.${"z".repeat(64)}`, // non-hex mac
      `.${"a".repeat(64)}`, // missing issuedAt
      `${"a".repeat(64)}`, // missing the dot + issuedAt
    ]) {
      expect(
        Publish.safeParse({
          id: ENTRY_ID,
          confirm: true,
          previewToken: bad,
          expectedFirstPublish: true,
        }).success,
      ).toBe(false);
    }
  });

  it("rejects a missing expectedFirstPublish", () => {
    expect(
      Publish.safeParse({
        id: ENTRY_ID,
        confirm: true,
        previewToken: VALID_TOKEN,
      }).success,
    ).toBe(false);
  });

  it("rejects a non-uuid id", () => {
    expect(
      Publish.safeParse({
        id: "not-a-uuid",
        confirm: true,
        previewToken: VALID_TOKEN,
        expectedFirstPublish: true,
      }).success,
    ).toBe(false);
  });

  it("the token regex is anchored to the issuedAt.mac shape", () => {
    expect(PREVIEW_TOKEN_PATTERN.test(VALID_TOKEN)).toBe(true);
    expect(PREVIEW_TOKEN_PATTERN.test(`prefix ${VALID_TOKEN}`)).toBe(false);
    expect(PREVIEW_TOKEN_PATTERN.test(`${VALID_TOKEN} suffix`)).toBe(false);
  });
});

describe("MergeFeedbackInput (merge friction)", () => {
  it("accepts a well-formed input", () => {
    const parsed = Merge.parse({
      duplicateId: DUP_ID,
      canonicalId: CANON_ID,
      confirm: true,
      expectedCanonicalTitle: "Dark mode",
    });
    expect(parsed.expectedCanonicalTitle).toBe("Dark mode");
  });

  it("rejects confirm:false (must be the literal true)", () => {
    expect(
      Merge.safeParse({
        duplicateId: DUP_ID,
        canonicalId: CANON_ID,
        confirm: false,
        expectedCanonicalTitle: "Dark mode",
      }).success,
    ).toBe(false);
  });

  it("rejects a missing expectedCanonicalTitle", () => {
    expect(
      Merge.safeParse({
        duplicateId: DUP_ID,
        canonicalId: CANON_ID,
        confirm: true,
      }).success,
    ).toBe(false);
  });

  it("rejects a non-uuid duplicateId / canonicalId", () => {
    expect(
      Merge.safeParse({
        duplicateId: "nope",
        canonicalId: CANON_ID,
        confirm: true,
        expectedCanonicalTitle: "Dark mode",
      }).success,
    ).toBe(false);
    expect(
      Merge.safeParse({
        duplicateId: DUP_ID,
        canonicalId: "nope",
        confirm: true,
        expectedCanonicalTitle: "Dark mode",
      }).success,
    ).toBe(false);
  });

  it("rejects an over-long expectedCanonicalTitle (>500)", () => {
    expect(
      Merge.safeParse({
        duplicateId: DUP_ID,
        canonicalId: CANON_ID,
        confirm: true,
        expectedCanonicalTitle: "x".repeat(501),
      }).success,
    ).toBe(false);
  });
});
