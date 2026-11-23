"use client";

import { useCallback, useState } from "react";
import { useRecoverablePlay } from "@/hooks/useRecoverablePlay";
import { displayStorageKey } from "./engine";
import type { CodeSwitchAction, CodeSwitchPlayState } from "./types";

export function readDisplayPin(sessionId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(displayStorageKey(sessionId)) === "1";
  } catch {
    return false;
  }
}

export function writeDisplayPin(sessionId: string, pinned: boolean): void {
  try {
    const key = displayStorageKey(sessionId);
    if (pinned) window.localStorage.setItem(key, "1");
    else window.localStorage.removeItem(key);
  } catch {
    /* ignore quota */
  }
}

const prepare = (state: CodeSwitchPlayState, action: CodeSwitchAction): CodeSwitchAction =>
  ({ ...action, roundId: state.roundId });
const recoverable = (action: CodeSwitchAction) =>
  (action.type === "lockClue" || action.type === "lockGuess") && typeof action.roundId === "string";

export function useCodeSwitchPlay(sessionId: string) {
  const [pin, setPin] = useState(() => ({ sessionId, pinned: readDisplayPin(sessionId) }));
  const isDisplay = pin.sessionId === sessionId ? pin.pinned : readDisplayPin(sessionId);
  const play = useRecoverablePlay<CodeSwitchPlayState, CodeSwitchAction>({
    protocol: "code-switch", sessionId, query: isDisplay ? "?display=1" : "", prepare, recoverable,
  });
  const pinDisplay = useCallback((pinned: boolean) => {
    writeDisplayPin(sessionId, pinned);
    setPin({ sessionId, pinned });
  }, [sessionId]);
  return { ...play, state: isDisplay && !play.state?.isDisplay ? null : play.state, isDisplay, pinDisplay };
}
