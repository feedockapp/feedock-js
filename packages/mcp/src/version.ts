/**
 * Server identity reported in the MCP `initialize` handshake.
 *
 * The version is INJECTED at build time from `package.json` (esbuild `define`
 * in build.mjs) — it is not a number anyone has to remember to bump. It used to
 * be a hand-maintained constant whose comment claimed "the Changesets release
 * flow keeps both honest"; Changesets only bumps `package.json`, so the two
 * drifted (the handshake still said 0.1.0 at package 0.3.0, which is exactly
 * the lie you cannot afford when someone asks a client which version it runs).
 *
 * The `?? ` fallback covers non-bundled consumers (vitest imports the source
 * directly, where the define never runs).
 */

declare const __SERVER_VERSION__: string | undefined;

export const SERVER_NAME = "feedock";
export const SERVER_VERSION =
  typeof __SERVER_VERSION__ === "string" ? __SERVER_VERSION__ : "0.0.0-dev";
