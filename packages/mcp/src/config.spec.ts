/**
 * Config validation (docs/features/mcp-server.md §4 + §6 rule 6). The PAT is a
 * Bearer credential: it must never traverse the network in cleartext, so plain
 * `http:` is allowed ONLY for loopback hosts; every other host must use `https:`.
 * The token value is never echoed back in an error.
 */

import { describe, expect, it } from "vitest";

import { ConfigError, loadConfig } from "./config.js";

const TOKEN = "fdk_pat_" + "a".repeat(64);

function env(overrides: Record<string, string>): NodeJS.ProcessEnv {
  return { FEEDOCK_API_TOKEN: TOKEN, ...overrides };
}

describe("loadConfig — URL scheme + cleartext guard", () => {
  it("accepts https for any host", () => {
    const cfg = loadConfig(env({ FEEDOCK_API_URL: "https://api.feedock.com" }));
    expect(cfg.apiUrl).toBe("https://api.feedock.com");
    expect(cfg.graphqlUrl).toBe("https://api.feedock.com/graphql");
  });

  it("accepts plain http for loopback hosts (local dev)", () => {
    for (const url of [
      "http://localhost:4400",
      "http://127.0.0.1:4400",
      "http://[::1]:4400",
      "http://api.localhost:4400",
    ]) {
      expect(() => loadConfig(env({ FEEDOCK_API_URL: url }))).not.toThrow();
    }
  });

  it("rejects plain http for a non-local host (would send the token in cleartext)", () => {
    expect(() =>
      loadConfig(env({ FEEDOCK_API_URL: "http://api.feedock.com" })),
    ).toThrow(ConfigError);
    expect(() =>
      loadConfig(env({ FEEDOCK_API_URL: "http://10.0.0.5:4400" })),
    ).toThrow(/https/i);
  });

  it("rejects a non-http(s) scheme", () => {
    expect(() =>
      loadConfig(env({ FEEDOCK_API_URL: "ftp://api.feedock.com" })),
    ).toThrow(ConfigError);
  });

  it("rejects a malformed URL", () => {
    expect(() => loadConfig(env({ FEEDOCK_API_URL: "not a url" }))).toThrow(
      ConfigError,
    );
  });

  it("strips trailing slashes so graphqlUrl is well-formed", () => {
    const cfg = loadConfig(
      env({ FEEDOCK_API_URL: "https://api.feedock.com///" }),
    );
    expect(cfg.graphqlUrl).toBe("https://api.feedock.com/graphql");
  });
});

describe("loadConfig — token + required vars", () => {
  it("rejects a token without the fdk_pat_ prefix", () => {
    expect(() =>
      loadConfig({
        FEEDOCK_API_URL: "https://api.feedock.com",
        FEEDOCK_API_TOKEN: "nope",
      }),
    ).toThrow(ConfigError);
  });

  it("never echoes the token value in an error", () => {
    try {
      loadConfig({
        FEEDOCK_API_URL: "https://api.feedock.com",
        FEEDOCK_API_TOKEN: "secret-not-a-pat",
      });
      throw new Error("expected loadConfig to throw");
    } catch (err) {
      expect(String((err as Error).message)).not.toContain("secret-not-a-pat");
    }
  });

  it("throws when a required var is missing", () => {
    expect(() => loadConfig({ FEEDOCK_API_TOKEN: TOKEN })).toThrow(
      /FEEDOCK_API_URL/,
    );
  });
});
