"use client";

import { useCallback, useMemo } from "react";

import type {
  FollowResult,
  StartIdentityResult,
  SubscribeResult,
  VoteResult,
} from "./client";
import { useFeedockContext, type VisitorIdentity } from "./context";
import type { SimilarFeedback } from "./types";

/**
 * Low-level Feedock hook for building custom UIs. The bundled components
 * (`<FeedbackBoard>`, `<Roadmap>`, `<Changelog>`) use this under the hood; reach
 * for it directly only when you want your own markup.
 */
export function useFeedock() {
  const { client, identity, setIdentity, clearIdentity, ensureIdentity } =
    useFeedockContext();

  const requireToken = useCallback((): string => {
    if (!identity) {
      throw new Error(
        "Visitor is not verified. Complete the identity flow first.",
      );
    }
    return identity.token;
  }, [identity]);

  // Run a token-gated call so a missing token becomes a REJECTED promise, not a
  // synchronous throw — every write returns a promise, so `.catch()` on it must
  // actually catch the not-verified error rather than throw past the caller.
  const withToken = useCallback(
    <T>(run: (token: string) => Promise<T>): Promise<T> => {
      let token: string;
      try {
        token = requireToken();
      } catch (error) {
        return Promise.reject(error as Error);
      }
      return run(token);
    },
    [requireToken],
  );

  // Memoized as a whole. This is the hook custom UIs build on, so its values
  // land in THEIR dependency arrays and memo comparisons — a fresh object every
  // render would quietly re-fire those. It's also what makes requireToken's
  // useCallback above mean anything: memoizing an inner function that only
  // sibling methods on a brand-new object ever call buys nothing.
  return useMemo(
    () => ({
      identity,
      isVerified: identity !== null,

      /**
       * Resolve identity WITHOUT prompting — returns the current session, awaits an
       * in-flight host-SSO auto-identify, or resolves `null` for a true anonymous.
       * Call before showing the email prompt so a signed-in host user is silent.
       */
      ensureIdentity,

      /** Step 1 of the magic-link flow: email the visitor a verification link. */
      startIdentity(email: string): Promise<StartIdentityResult> {
        return client.startIdentity(email);
      },

      /** Step 2: exchange the magic-link token for a verified-visitor session. */
      async verify(token: string): Promise<VisitorIdentity> {
        const result = await client.verifyIdentity(token);
        const next = { token: result.token, email: result.email };
        setIdentity(next);
        return next;
      },

      /**
       * Recognize an already-authenticated user via a host-signed SSO token
       * (skips the email magic-link). Sign the token on your backend with the
       * project's SSO secret.
       */
      async identify(userToken: string): Promise<VisitorIdentity> {
        const result = await client.exchangeSso(userToken);
        const next = { token: result.token, email: result.email };
        setIdentity(next);
        return next;
      },

      /** Forget the current verified visitor. */
      signOut: clearIdentity,

      vote(feedbackId: string): Promise<VoteResult> {
        return withToken((token) => client.vote(token, feedbackId));
      },

      /** Follow / unfollow a feedback item ("notify me when this ships"). */
      setFollow(feedbackId: string, following: boolean): Promise<FollowResult> {
        return withToken((token) =>
          client.setFollow(token, feedbackId, following),
        );
      },

      /**
       * Find PUBLIC feedback similar to a draft (dedupe-at-submit). No
       * verification needed — reads only public data.
       */
      similar(input: {
        title: string;
        body?: string;
      }): Promise<SimilarFeedback[]> {
        return client.similarFeedback(input);
      },

      submit(input: {
        title: string;
        body: string;
        boardSlug?: string;
        notifyMe?: boolean;
      }) {
        return withToken((token) => client.submitFeedback(token, input));
      },

      /** Upload an image/video/file onto a feedback item the visitor just created. */
      uploadAttachment(feedbackId: string, file: File) {
        return withToken((token) =>
          client.uploadAttachment(token, feedbackId, file),
        );
      },

      comment(feedbackId: string, body: string) {
        return withToken((token) => client.comment(token, feedbackId, body));
      },

      subscribe(input: {
        email: string;
        consent: boolean;
        scope?: string;
        source?: string;
      }): Promise<SubscribeResult> {
        return client.subscribe(input);
      },
    }),
    [client, identity, setIdentity, clearIdentity, ensureIdentity, withToken],
  );
}
