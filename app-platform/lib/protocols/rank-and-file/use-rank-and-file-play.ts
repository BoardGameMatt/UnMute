"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkshopPlay } from "@/hooks/useWorkshopPlay";
import { displayStorageKey, withOptimisticRail } from "./engine";
import type { RankAndFileAction, RankAndFilePlayState } from "./types";

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

export function useRankAndFilePlay(sessionId: string) {
  const [isDisplay, setIsDisplay] = useState(() => readDisplayPin(sessionId));
  const play = useWorkshopPlay<RankAndFilePlayState, RankAndFileAction>("rank-and-file", sessionId, isDisplay ? "?display=1" : "");
  const [rail, setRail] = useState<(string | null)[] | null>(null);
  const queued = useRef<(string | null)[] | null>(null);
  const busy = useRef(false);
  useEffect(() => { setIsDisplay(readDisplayPin(sessionId)); setRail(null); }, [sessionId]);
  const sendAction = play.send;
  const send = useCallback(async (action: RankAndFileAction): Promise<boolean> => {
    if (action.type !== "setRail") return sendAction(action);
    setRail(action.dealIds);
    queued.current = action.dealIds;
    if (busy.current) return true;
    busy.current = true;
    let accepted = true;
    try {
      while (queued.current) {
        const dealIds = queued.current; queued.current = null;
        accepted = await sendAction({ type: "setRail", dealIds });
        if (!accepted) { queued.current = null; break; }
      }
    } finally { busy.current = false; setRail(null); }
    return accepted;
  }, [sendAction]);
  const pinDisplay = useCallback((pinned: boolean) => { writeDisplayPin(sessionId, pinned); setIsDisplay(pinned); }, [sessionId]);
  return { ...play, state: play.state && rail ? withOptimisticRail(play.state, rail) : play.state, send, isDisplay, pinDisplay };
}
