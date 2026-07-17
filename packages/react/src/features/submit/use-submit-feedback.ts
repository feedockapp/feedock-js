"use client";

import { useEffect, useReducer, useRef, useState } from "react";

import type { PublicFeedbackListItem } from "../../types";
import { useFeedock } from "../../use-feedock";
import {
  collectFiles,
  isDraftSubmittable,
  validateDraft,
  type DraftErrors,
  type FeedbackDraft,
} from "./submit-feedback-form";

type UseSubmitFeedbackArgs = {
  onSubmitted: (item: PublicFeedbackListItem) => void;
};

export type UseSubmitFeedback = {
  title: string;
  setTitle: (value: string) => void;
  body: string;
  setBody: (value: string) => void;
  notifyMe: boolean;
  setNotifyMe: (value: boolean) => void;
  files: File[];
  addFiles: (selected: FileList | null) => void;
  removeFile: (index: number) => void;
  fileInput: React.RefObject<HTMLInputElement | null>;
  /** Field-level validation of the draft (UX-only; the API re-validates). */
  errors: DraftErrors;
  /** True when the draft passes every field rule. */
  canSubmit: boolean;
  /** In-flight submit + upload pass. */
  busy: boolean;
  /** A submit/upload failure to surface (distinct from field validation). */
  error: string | null;
  /** Fade + slide the composer in when it opens (CSS transition, no motion dep). */
  shown: boolean;
  onSubmit: () => Promise<void>;
};

/** All the composer's mutable state in one place (replaces six `useState`s). */
type State = {
  draft: FeedbackDraft;
  files: File[];
  busy: boolean;
  error: string | null;
};

/** Reducer action tags, named so the switch and the dispatches can't drift. */
const SUBMIT_ACTION = {
  SetField: "setField",
  AddFiles: "addFiles",
  RemoveFile: "removeFile",
  SubmitStart: "submitStart",
  SubmitFailed: "submitFailed",
  SubmitDone: "submitDone",
} as const;

type Action =
  | {
      type: typeof SUBMIT_ACTION.SetField;
      field: keyof FeedbackDraft;
      value: string | boolean;
    }
  | { type: typeof SUBMIT_ACTION.AddFiles; incoming: FileList | null }
  | { type: typeof SUBMIT_ACTION.RemoveFile; index: number }
  | { type: typeof SUBMIT_ACTION.SubmitStart }
  | { type: typeof SUBMIT_ACTION.SubmitFailed; error: string }
  | { type: typeof SUBMIT_ACTION.SubmitDone };

const INITIAL_STATE: State = {
  draft: { title: "", body: "", notifyMe: false },
  files: [],
  busy: false,
  error: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case SUBMIT_ACTION.SetField:
      return {
        ...state,
        draft: { ...state.draft, [action.field]: action.value },
      };
    case SUBMIT_ACTION.AddFiles: {
      const { files, error } = collectFiles(state.files, action.incoming);
      return { ...state, files, error };
    }
    case SUBMIT_ACTION.RemoveFile:
      return {
        ...state,
        files: state.files.filter((_, index) => index !== action.index),
      };
    case SUBMIT_ACTION.SubmitStart:
      return { ...state, busy: true, error: null };
    case SUBMIT_ACTION.SubmitFailed:
      return { ...state, busy: false, error: action.error };
    case SUBMIT_ACTION.SubmitDone:
      return { ...state, busy: false };
    default:
      return state;
  }
}

/**
 * Submit + multi-upload orchestration for the SDK composer. Holds the draft +
 * attachments + busy/error flags in one reducer, exposes field-level validation
 * (via the shared `submit-feedback-form` module), and runs the `Promise.allSettled`
 * upload pass with partial-failure handling (the post is already saved
 * server-side, so a failed upload surfaces a note and keeps the composer open
 * rather than discarding it).
 */
export function useSubmitFeedback({
  onSubmitted,
}: UseSubmitFeedbackArgs): UseSubmitFeedback {
  const { submit, uploadAttachment } = useFeedock();
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const fileInput = useRef<HTMLInputElement>(null);

  // Fade + slide the composer in when it opens (CSS transition, no motion dep).
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function setField(field: keyof FeedbackDraft, value: string | boolean) {
    dispatch({ type: SUBMIT_ACTION.SetField, field, value });
  }

  function addFiles(selected: FileList | null) {
    dispatch({ type: SUBMIT_ACTION.AddFiles, incoming: selected });
    if (fileInput.current) {
      fileInput.current.value = "";
    }
  }

  /** Upload every attachment in parallel; resolve to the failed count. */
  async function uploadAttachments(feedbackId: string): Promise<number> {
    if (state.files.length === 0) {
      return 0;
    }
    const results = await Promise.allSettled(
      state.files.map((file) => uploadAttachment(feedbackId, file)),
    );
    return results.filter((result) => result.status === "rejected").length;
  }

  async function onSubmit() {
    dispatch({ type: SUBMIT_ACTION.SubmitStart });
    try {
      const item = await submit({
        title: state.draft.title.trim(),
        body: state.draft.body.trim(),
        notifyMe: state.draft.notifyMe,
      });
      const failed = await uploadAttachments(item.id);
      if (failed > 0) {
        // The post was created, but some uploads failed — surface it instead of
        // silently dropping them (mirrors the hosted portal). Keep the composer
        // open so the note is visible; the item is already saved server-side.
        const plural = failed > 1 ? "s" : "";
        dispatch({
          type: SUBMIT_ACTION.SubmitFailed,
          error: `Your post was created, but ${failed} file${plural} couldn't be uploaded.`,
        });
        return;
      }
      dispatch({ type: SUBMIT_ACTION.SubmitDone });
      onSubmitted(item);
    } catch (caught) {
      dispatch({
        type: SUBMIT_ACTION.SubmitFailed,
        error: caught instanceof Error ? caught.message : "Could not submit.",
      });
    }
  }

  return {
    title: state.draft.title,
    setTitle: (value) => setField("title", value),
    body: state.draft.body,
    setBody: (value) => setField("body", value),
    notifyMe: state.draft.notifyMe,
    setNotifyMe: (value) => setField("notifyMe", value),
    files: state.files,
    addFiles,
    removeFile: (index) => dispatch({ type: SUBMIT_ACTION.RemoveFile, index }),
    fileInput,
    errors: validateDraft(state.draft),
    canSubmit: isDraftSubmittable(state.draft),
    busy: state.busy,
    error: state.error,
    shown,
    onSubmit,
  };
}
