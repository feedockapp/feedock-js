/**
 * The links npm renders on a package page must be PUBLIC.
 *
 * The source repo is private, so `repository` and `bugs` pointed at
 * github.com/feedockapp/feedock — npm turned both into buttons that 404'd for
 * every reader, and the React README's "full guide" link did the same (npm
 * resolves relative links against the repo). This pins the rule that broke:
 * nothing a reader can click may lead somewhere only we can open.
 *
 * Network-free on purpose — it checks the SHAPE, so it runs in CI without
 * depending on feedock.com being up. (The anchors themselves were verified
 * against the live page when written; see docs/features/integration.md.)
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGES = join(HERE, "../..");

type Manifest = {
  name: string;
  homepage?: string;
  bugs?: { url?: string };
  repository?: { url?: string; directory?: string };
  description?: string;
};

const MANIFESTS: Manifest[] = ["mcp", "react"].map(
  (p) => JSON.parse(readFileSync(join(PACKAGES, p, "package.json"), "utf8")) as Manifest,
);

const READMES = ["mcp", "react"].map((p) => ({
  name: p,
  text: readFileSync(join(PACKAGES, p, "README.md"), "utf8"),
}));

/** The scope we abandoned. Nothing is published under it, so a reader who copies
 *  an `@feedockapp/…` name out of a live instruction gets a 404. */
const DEAD_SCOPE = /@feedockapp\//;

/** The CHANGELOG's H1 — the package it claims to be the history OF. The rename
 *  left this line reading `# @feedockapp/mcp` with nothing watching it. */
const CHANGELOGS = ["mcp", "react"].map((p) => ({
  name: `${p}/CHANGELOG.md`,
  expected: `@feedock/${p}`,
  title: readFileSync(join(PACKAGES, p, "CHANGELOG.md"), "utf8")
    .split("\n")[0]
    ?.trim(),
}));

/** The private source repo — unreachable for a reader. (`feedock-js`, the
 *  public mirror, must not match: the `(?!-js)` keeps them apart.) */
const PRIVATE_REPO = /github\.com\/feedockapp\/feedock(?!-js)(?:[/.]|$)/;

describe.each(MANIFESTS)("$name package links", (m) => {
  it("has a homepage on the public site", () => {
    expect(m.homepage).toMatch(/^https:\/\/feedock\.com\//);
  });

  it("points bugs somewhere a reader can actually open", () => {
    expect(m.bugs?.url).toBeDefined();
    expect(m.bugs?.url).not.toMatch(PRIVATE_REPO);
  });

  // npm renders `repository` as a link, so it must resolve for a reader: the
  // PUBLIC mirror, never the private monorepo (which 404'd for everyone).
  it("points repository at the public mirror", () => {
    const url = (m.repository as { url?: string } | undefined)?.url ?? "";
    expect(url).toContain("feedockapp/feedock-js");
    expect(url).not.toMatch(PRIVATE_REPO);
  });

  it("describes itself for the npm search result", () => {
    expect(m.description ?? "").not.toHaveLength(0);
  });
});

// The live install surface — what a reader copies TODAY. A dead name here is an
// instruction that 404s, so nothing may carry one.
describe.each(READMES)("$name README names a package that exists", ({ text }) => {
  it("never points at the abandoned @feedockapp scope", () => {
    expect(text.split("\n").filter((l) => DEAD_SCOPE.test(l))).toEqual([]);
  });
});

// The CHANGELOG is different in kind, and the first version of this guard got it
// wrong by treating it the same: it banned the dead scope from the whole file and
// then failed on the very entry DESCRIBING the rename, which quotes the old name
// on purpose. A changelog is history — naming what something used to be called is
// its job. Only the H1 has to be current, because that names the package the file
// is the history of, and that is the line the rename actually rotted.
describe.each(CHANGELOGS)("$name is titled for the current package", (c) => {
  it(`is headed ${c.expected}`, () => {
    expect(c.title).toBe(`# ${c.expected}`);
  });
});

describe.each(READMES)("$name README links", ({ text }) => {
  it("links nothing in the private repo", () => {
    const links = [...text.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1] ?? "");
    expect(links.filter((l) => PRIVATE_REPO.test(l))).toEqual([]);
  });

  // npm resolves a relative link against the source repo — private, so it 404s.
  it("uses no relative links (npm resolves them against the repo)", () => {
    const links = [...text.matchAll(/\]\((\.\.?\/[^)]+)\)/g)].map((m) => m[1]);
    expect(links).toEqual([]);
  });

  // Pins the CLAIM, not the markup: a reader landing from npm has never heard of
  // Feedock, so the page has to say what it is and link somewhere to find out
  // more. An earlier version asserted a literal "What is Feedock?" heading and
  // failed the moment the same fact moved into prose — it guarded the heading
  // instead of the reader.
  it("tells a cold reader what Feedock is", () => {
    expect(text).toMatch(/is a feedback and roadmap workspace/);
    expect(text).toContain("https://feedock.com");
  });
});
