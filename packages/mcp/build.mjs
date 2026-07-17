import { readFileSync } from "node:fs";

import * as esbuild from "esbuild";

/** The published version — the ONE source of truth for the handshake. */
const { version } = JSON.parse(readFileSync("./package.json", "utf8"));

/**
 * Publish build for `@feedock/mcp`.
 *
 * Bundles the CLI (`dist/cli.js`, the `feedock-mcp` bin) and the library entry
 * (`dist/index.js`) into self-contained ESM, **inlining the workspace
 * `@feedock/sanitize`** so the published package has no `workspace:*` runtime
 * dependency (which `npx`/npm could never resolve). The real third-party deps
 * stay **external** — npm installs them from the registry — keeping the bundle
 * small and the dependency graph honest.
 *
 * Types are emitted separately by `tsc --emitDeclarationOnly` (see the build
 * script); `lib/sanitize.ts` re-exports through local wrappers so no `.d.ts`
 * references `@feedock/sanitize`.
 */
const EXTERNAL = [
  // The MCP SDK (+ its deep import subpaths) — a peer-ish runtime dep.
  "@modelcontextprotocol/sdk",
  "@modelcontextprotocol/sdk/*",
  // GraphQL transport + validation — public npm packages, installed normally.
  "graphql",
  "graphql-request",
  "zod",
  // The sanitizer engine `@feedock/sanitize` wraps — keep external (npm dep);
  // only the thin `@feedock/sanitize` wrapper code is bundled in.
  "sanitize-html",
];

/**
 * ESM `require` shim. `@feedock/sanitize` (CJS) `require()`s the external
 * `sanitize-html`; bundled into an ESM module, esbuild lowers that to
 * `__require(...)`, whose fallback throws "Dynamic require not supported" because
 * ESM provides no global `require`. Defining a real `require` via `createRequire`
 * makes esbuild's `__require` resolve to it — so the external CJS dep loads at
 * runtime. Without this, sanitization would throw on first use (silent XSS gap).
 */
const REQUIRE_SHIM =
  'import { createRequire as __createRequire } from "node:module";\n' +
  "const require = __createRequire(import.meta.url);";

const shared = {
  bundle: true,
  // The handshake version comes from package.json at build time, so Changesets
  // bumping the manifest is enough — no second place to remember.
  define: { __SERVER_VERSION__: JSON.stringify(version) },
  platform: "node",
  format: "esm",
  target: ["node20"],
  sourcemap: true,
  external: EXTERNAL,
  logLevel: "info",
};

await esbuild.build({
  ...shared,
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  banner: { js: REQUIRE_SHIM },
});

await esbuild.build({
  ...shared,
  entryPoints: ["src/cli.ts"],
  outfile: "dist/cli.js",
  // The bin shebang must be line 1; the require shim follows it.
  banner: { js: "#!/usr/bin/env node\n" + REQUIRE_SHIM },
});

console.log("Built dist/index.js + dist/cli.js (workspace deps bundled)");
