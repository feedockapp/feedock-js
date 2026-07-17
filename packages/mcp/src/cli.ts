/**
 * stdio entry point for the `feedock-mcp` binary (docs/features/mcp-server.md §4).
 *
 * The `#!/usr/bin/env node` shebang is prepended by the publish build
 * (`build.mjs` esbuild banner), not kept in source, so the bundle carries
 * exactly one shebang on line 1.
 *
 * Parses env → builds the server → connects a `StdioServerTransport`. The server
 * speaks JSON-RPC over **stdout**, so **every** log here goes to **stderr**
 * (`console.error`, never `console.log`) — one stray stdout write corrupts the
 * protocol (§4.1). The PAT is never logged (§6 rule 6).
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { ConfigError, loadConfig } from "./config.js";
import { createServer } from "./server.js";
import { SERVER_VERSION } from "./version.js";

/** Load config or print a safe message + exit non-zero (operator-facing). */
function loadConfigOrExit(): ReturnType<typeof loadConfig> {
  try {
    return loadConfig();
  } catch (err) {
    const message =
      err instanceof ConfigError
        ? err.message
        : "Failed to load Feedock MCP configuration.";
    console.error(`[feedock-mcp] ${message}`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const config = loadConfigOrExit();

  const server = createServer({ config });
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(
    `[feedock-mcp] v${SERVER_VERSION} ready on stdio (api: ${config.apiUrl})`,
  );
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[feedock-mcp] fatal: ${message}`);
  process.exit(1);
});
