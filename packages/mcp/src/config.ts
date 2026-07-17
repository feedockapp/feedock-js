/**
 * Environment config — `FEEDOCK_API_URL`, `FEEDOCK_API_TOKEN`.
 *
 * Parsed once at startup; **fails fast** with a clear, secret-free message if a
 * required var is missing or malformed (docs/features/mcp-server.md §4). The
 * token is the founder's Personal Access Token (PAT, `fdk_pat_…`) — it is the
 * Bearer credential and is **never logged** (§6 rule 6).
 */

/** Prefix every Feedock PAT carries (docs/features/mcp-server.md §3.1). */
export const PAT_PREFIX = "fdk_pat_";

/** Resolved, validated server configuration. */
export interface FeedockConfig {
  /** Base API origin, e.g. `https://api.feedock.com` (no trailing slash). */
  readonly apiUrl: string;
  /** Full GraphQL endpoint, `${apiUrl}/graphql`. */
  readonly graphqlUrl: string;
  /** The Personal Access Token — the project-bound Bearer credential. */
  readonly apiToken: string;
}

/** Thrown when the environment is not usable; the CLI prints it to stderr. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * The env shape `loadConfig` reads — a plain string map, deliberately NOT
 * `NodeJS.ProcessEnv`, so the published `.d.ts` is self-contained and a consumer
 * compiling without `@types/node` (e.g. `types: []`) still resolves the type.
 * `process.env` satisfies it.
 */
type EnvLike = Record<string, string | undefined>;

function requireEnv(env: EnvLike, key: string): string {
  const raw = env[key];
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new ConfigError(
      `Missing required environment variable ${key}. Set it in your MCP client config (see the @feedock/mcp README).`,
    );
  }
  return raw.trim();
}

/**
 * Whether a URL hostname is a loopback address — the only hosts we allow plain
 * `http:` for, since the PAT Bearer token would otherwise traverse the network
 * in cleartext. `URL.hostname` strips the port and unwraps IPv6 brackets.
 */
function isLoopbackHost(hostname: string): boolean {
  // `URL.hostname` keeps the brackets on an IPv6 literal (`[::1]`) — strip them.
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "::1" ||
    h === "0.0.0.0" ||
    h.endsWith(".localhost")
  );
}

/**
 * Read + validate config from `process.env` (or a provided env, for tests).
 * Never echoes the token value back in an error.
 */
export function loadConfig(env: EnvLike = process.env): FeedockConfig {
  const apiUrlRaw = requireEnv(env, "FEEDOCK_API_URL");
  const apiToken = requireEnv(env, "FEEDOCK_API_TOKEN");

  let parsed: URL;
  try {
    parsed = new URL(apiUrlRaw);
  } catch {
    throw new ConfigError(
      "FEEDOCK_API_URL is not a valid URL (expected e.g. https://api.feedock.com).",
    );
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ConfigError(
      "FEEDOCK_API_URL must use http(s) (expected e.g. https://api.feedock.com).",
    );
  }
  // The PAT is a Bearer credential — never send it in cleartext to a remote
  // host. Allow plain `http:` only for loopback (local dev against the API on
  // 127.0.0.1/localhost); any other host must use `https:`.
  if (parsed.protocol === "http:" && !isLoopbackHost(parsed.hostname)) {
    throw new ConfigError(
      "FEEDOCK_API_URL must use https for non-local hosts (plain http would send your token in cleartext). Use https://, or http://localhost for local dev.",
    );
  }

  if (!apiToken.startsWith(PAT_PREFIX)) {
    throw new ConfigError(
      `FEEDOCK_API_TOKEN does not look like a Feedock token (it should start with "${PAT_PREFIX}"). Generate one in your project's Settings → API tokens.`,
    );
  }

  // Normalize: strip trailing slashes so `${apiUrl}/graphql` is well-formed.
  const apiUrl = apiUrlRaw.replace(/\/+$/, "");

  return {
    apiUrl,
    graphqlUrl: `${apiUrl}/graphql`,
    apiToken,
  };
}
