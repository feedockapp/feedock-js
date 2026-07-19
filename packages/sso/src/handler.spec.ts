import { jwtVerify } from "jose";
import { describe, expect, it, vi } from "vitest";

import { MAX_TOKEN_TTL_SECONDS } from "./constants.js";
import { createIdentifyHandler } from "./handler.js";

const SECRET = "test-secret-test-secret-test-secret-1234";
const key = new TextEncoder().encode(SECRET);
const REQ = new Request("https://acme.com/feedock/identify");

describe("createIdentifyHandler", () => {
  it("204s (no body) when nobody is signed in", async () => {
    const handler = createIdentifyHandler({
      secret: SECRET,
      getUser: () => null,
    });
    const res = await handler(REQ);
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    // A per-user token must never be cached, including the anonymous answer.
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("returns a verifiable userToken for a signed-in user", async () => {
    const handler = createIdentifyHandler({
      secret: SECRET,
      getUser: () => ({ email: "ada@acme.com", name: "Ada", sub: "u_1" }),
    });
    const res = await handler(REQ);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");

    const { userToken } = (await res.json()) as { userToken: string };
    const { payload } = await jwtVerify(userToken, key, {
      algorithms: ["HS256"],
      requiredClaims: ["exp"],
      maxTokenAge: MAX_TOKEN_TTL_SECONDS,
      clockTolerance: 5,
    });
    expect(payload).toMatchObject({
      email: "ada@acme.com",
      name: "Ada",
      sub: "u_1",
    });
  });

  it("awaits an async getUser and passes it the request", async () => {
    const getUser = vi.fn().mockResolvedValue({ email: "a@b.c" });
    const handler = createIdentifyHandler({ secret: SECRET, getUser });
    const res = await handler(REQ);
    expect(res.status).toBe(200);
    expect(getUser).toHaveBeenCalledWith(REQ);
  });

  it("throws at wiring time (not per-request) on a missing secret or getUser", () => {
    expect(() =>
      createIdentifyHandler({ secret: "", getUser: () => null }),
    ).toThrow(/secret/i);
    expect(() =>
      createIdentifyHandler({
        secret: SECRET,
        getUser: undefined as unknown as () => null,
      }),
    ).toThrow(/getUser/i);
  });
});
