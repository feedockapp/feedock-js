"use client";

import { useState } from "react";

import type { VisitorIdentity } from "../../context";
import { useFeedock } from "../../use-feedock";

type IdentityPhase = "email" | "sent";

type UseIdentityPromptArgs = {
  onVerified: (identity: VisitorIdentity) => void;
};

export type UseIdentityPrompt = {
  email: string;
  setEmail: (value: string) => void;
  token: string;
  setToken: (value: string) => void;
  phase: IdentityPhase;
  busy: boolean;
  error: string | null;
  canStart: boolean;
  canVerifyToken: boolean;
  start: () => Promise<void>;
  verifyToken: () => Promise<void>;
};

/**
 * Account-less visitor verification flow used before public writes.
 * Keeps API orchestration out of the prompt component and trims transient input
 * before sending it to the public identity endpoints.
 */
export function useIdentityPrompt({
  onVerified,
}: UseIdentityPromptArgs): UseIdentityPrompt {
  const { startIdentity, verify } = useFeedock();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [phase, setPhase] = useState<IdentityPhase>("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await startIdentity(normalizedEmail);
      if (result.devToken) {
        // Dev mode: no inbox round-trip needed.
        const identity = await verify(result.devToken);
        onVerified(identity);
        return;
      }
      setPhase("sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyToken() {
    const normalizedToken = token.trim();
    if (!normalizedToken) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const identity = await verify(normalizedToken);
      onVerified(identity);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid or expired token.");
    } finally {
      setBusy(false);
    }
  }

  return {
    email,
    setEmail,
    token,
    setToken,
    phase,
    busy,
    error,
    canStart: !busy && email.trim().length > 0,
    canVerifyToken: !busy && token.trim().length > 0,
    start,
    verifyToken,
  };
}
