"use client";

import { useWorkshopPlay } from "@/hooks/useWorkshopPlay";
import { displayStorageKey } from "./engine";
import type { AirtimeAction, AirtimePlayState } from "./types";

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

export function useAirtimePlay(sessionId: string) {
  return useWorkshopPlay<AirtimePlayState, AirtimeAction>("airtime", sessionId, readDisplayPin(sessionId) ? "?display=1" : "");
}
