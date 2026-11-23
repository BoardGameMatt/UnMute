"use client";

import { useWorkshopPlay } from "@/hooks/useWorkshopPlay";
import { displayStorageKey } from "./engine";
import type { EngineAction, OtspClientState } from "./types";

export type OtspSendAction = EngineAction | { type: "complete" };

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

export function useOtspPlay(sessionId: string) {
  return useWorkshopPlay<OtspClientState, OtspSendAction>("on-the-same-page", sessionId, readDisplayPin(sessionId) ? "?display=1" : "");
}
