"use client";

import type { VisitorIdentity } from "../../context";
import { useIdentityPrompt } from "./use-identity-prompt";
import { identityPromptStyles } from "./identity-prompt-styles";
import { useStyles } from "../../shared/lib/use-styles";

type Props = {
  /** What the visitor is trying to do, e.g. "vote" or "post". */
  action: string;
  /** Called with the freshly-verified identity (token available immediately). */
  onVerified: (identity: VisitorIdentity) => void;
  onCancel: () => void;
};

/**
 * Inline account-less verification: enter email → magic link. In the API's dev
 * mode the token is returned and we auto-verify; in production the visitor
 * clicks the emailed link, which verifies on the hosted portal — they then
 * paste nothing, the session is picked up on return (see docs). A manual token
 * field is offered as a fallback.
 */
export function IdentityPrompt({ action, onVerified, onCancel }: Props) {
  const styles = useStyles(identityPromptStyles);
  const {
    email,
    setEmail,
    token,
    setToken,
    phase,
    busy,
    error,
    canStart,
    canVerifyToken,
    start,
    verifyToken,
  } = useIdentityPrompt({ onVerified });

  return (
    <div style={styles.root}>
      <div style={styles.helpText}>
        Confirm your email to {action}. We’ll use it to verify it’s you and tell
        you when it ships.
      </div>

      {phase === "email" ? (
        <>
          <input
            type="email"
            aria-label="Email address"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
          />
          <div style={styles.actions}>
            <button
              type="button"
              onClick={start}
              disabled={!canStart}
              style={styles.primaryButton(busy)}
            >
              {busy ? "Sending…" : "Continue"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              style={styles.secondaryButton}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={styles.sentText}>
            Check your inbox for a verification link. Paste the token here if
            you have it:
          </div>
          <input
            type="text"
            aria-label="Verification token"
            placeholder="verification token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            style={styles.input}
          />
          <button
            type="button"
            onClick={verifyToken}
            disabled={!canVerifyToken}
            style={styles.primaryButton(busy)}
          >
            {busy ? "Verifying…" : "Verify"}
          </button>
        </>
      )}

      {error ? <div style={styles.error}>{error}</div> : null}
    </div>
  );
}
