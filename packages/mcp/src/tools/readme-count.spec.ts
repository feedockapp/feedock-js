/**
 * The README's tool count must match the tools actually registered.
 *
 * `README.md` ships inside the npm tarball, so its "through N tools" line is the
 * first thing a founder reads about the surface they are about to give a model.
 * It has drifted twice — it said 30 while 31 were registered, then 31 while 33
 * were — because the number is hand-maintained and nothing compared it to the
 * registry. This closes that loop: add a tool without updating the README and
 * this test fails with both numbers.
 */

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { createCaptureServer } from "../test-support.js";
import { registerAllTools } from "./index.js";

const README = new URL("../../README.md", import.meta.url);

function registeredToolCount(): number {
  const cap = createCaptureServer();
  registerAllTools(cap.server, {
    client: {
      request: async () => {
        throw new Error("registration must not call the client");
      },
    },
  });
  return cap.tools.size;
}

describe("README tool count", () => {
  it("matches the number of registered tools", () => {
    const readme = readFileSync(README, "utf8");
    const match = /through (\d+) tools/.exec(readme);
    expect(match, 'README must state "through N tools"').not.toBeNull();
    const stated = Number(match?.[1]);
    expect(stated).toBe(registeredToolCount());
  });
});
