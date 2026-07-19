import { decodeJwt, jwtVerify } from "jose";
import { describe, expect, it } from "vitest";

import { MAX_TOKEN_TTL_SECONDS } from "./constants.js";
import { signIdentity } from "./sign.js";

const SECRET = "test-secret-test-secret-test-secret-1234";
const key = new TextEncoder().encode(SECRET);

/**
 * The EXACT verify options apps/api uses in `exchangeSso`. If this package ever
 * drifts from the API's contract, these tests fail rather than customers
 * discovering it as an opaque 401.
 */
function verifyLikeTheApi(token: string) {
  return jwtVerify(token, key, {
    algorithms: ["HS256"],
    requiredClaims: ["exp"],
    maxTokenAge: MAX_TOKEN_TTL_SECONDS,
    clockTolerance: 5,
  });
}

describe("signIdentity", () => {
  it("produces a token the API's verify contract accepts", async () => {
    const token = await signIdentity(SECRET, { email: "ada@acme.com" });
    const { payload } = await verifyLikeTheApi(token);
    expect(payload.email).toBe("ada@acme.com");
    // iat is REQUIRED — maxTokenAge rejects a token without it.
    expect(typeof payload.iat).toBe("number");
    // A unique jti is what makes the exchange single-use server-side.
    expect(typeof payload.jti).toBe("string");
    expect(payload.exp).toBeGreaterThan(payload.iat as number);
  });

  it("defaults to a short expiry well under the API's ceiling", async () => {
    const { iat, exp } = decodeJwt(
      await signIdentity(SECRET, { email: "a@b.c" }),
    );
    expect((exp as number) - (iat as number)).toBeLessThanOrEqual(
      MAX_TOKEN_TTL_SECONDS,
    );
  });

  it("mints a fresh jti per call (so two tokens can't collide)", async () => {
    const a = decodeJwt(await signIdentity(SECRET, { email: "a@b.c" }));
    const b = decodeJwt(await signIdentity(SECRET, { email: "a@b.c" }));
    expect(a.jti).not.toBe(b.jti);
  });

  it("carries the optional claims when supplied, and omits them otherwise", async () => {
    const full = decodeJwt(
      await signIdentity(SECRET, {
        email: "buyer@bigco.com",
        name: "Grace",
        sub: "user_42",
        plan: "Enterprise",
        monthlyValueCents: 299900,
      }),
    );
    expect(full).toMatchObject({
      email: "buyer@bigco.com",
      name: "Grace",
      sub: "user_42",
      plan: "Enterprise",
      monthlyValueCents: 299900,
    });

    const minimal = decodeJwt(await signIdentity(SECRET, { email: "a@b.c" }));
    expect(minimal.name).toBeUndefined();
    expect(minimal.sub).toBeUndefined();
    expect(minimal.plan).toBeUndefined();
    expect(minimal.monthlyValueCents).toBeUndefined();
  });

  it("rejects a missing email locally instead of deferring to an opaque 401", async () => {
    await expect(signIdentity(SECRET, { email: "   " })).rejects.toThrow(
      /email/i,
    );
  });

  it("rejects a blank secret", async () => {
    await expect(signIdentity("", { email: "a@b.c" })).rejects.toThrow(
      /secret/i,
    );
  });

  it("rejects a ttl beyond the API's ceiling", async () => {
    await expect(
      signIdentity(
        SECRET,
        { email: "a@b.c" },
        { ttlSeconds: MAX_TOKEN_TTL_SECONDS + 1 },
      ),
    ).rejects.toThrow(/ttlSeconds/);
    await expect(
      signIdentity(SECRET, { email: "a@b.c" }, { ttlSeconds: 0 }),
    ).rejects.toThrow(/ttlSeconds/);
  });

  it("rejects a non-integer / negative monthlyValueCents", async () => {
    await expect(
      signIdentity(SECRET, { email: "a@b.c", monthlyValueCents: 12.5 }),
    ).rejects.toThrow(/monthlyValueCents/);
    await expect(
      signIdentity(SECRET, { email: "a@b.c", monthlyValueCents: -1 }),
    ).rejects.toThrow(/monthlyValueCents/);
  });

  it("does not verify against a different secret (anti-spoof)", async () => {
    const token = await signIdentity("another-secret-another-secret-1234", {
      email: "evil@acme.com",
    });
    await expect(verifyLikeTheApi(token)).rejects.toThrow();
  });
});
