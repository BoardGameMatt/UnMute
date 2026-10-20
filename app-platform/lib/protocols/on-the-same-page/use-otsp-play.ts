"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useGameState } from "@/components/providers/SessionProvider";
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

/** Fresh fetch on every realtime poke. The poke itself carries no secrets. */
export function useOtspPlay(sessionId: string) {
  const { phase, stateJson } = useGameState();
  const [state, setState] = useState<OtspClientState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const inflight = useRef(0);
  const fetchGen = useRef(0);

  const query = useCallback(() => (readDisplayPin(sessionId) ? "?display=1" : ""), [sessionId]);

  const accept = useCallback((next: OtspClientState) => {
    setClockOffsetMs(new Date(next.serverNow).getTime() - Date.now());
    setState(next);
  }, []);

  const reload = useCallback(async () => {
    if (inflight.current > 0) return;
    const gen = fetchGen.current;
    try {
      const res = await fetch(`/api/on-the-same-page/session/${sessionId}/play${query()}`, { cache: "no-store" });
      const body = (await res.json()) as { state?: OtspClientState | null; error?: string };
      if (gen !== fetchGen.current || inflight.current > 0) return;
      if (!res.ok) {
        setError(body.error ?? "Could not load On the Same Page.");
        return;
      }
      setError(null);
      if (body.state) accept(body.state);
    } catch {
      setError("Network error. Reconnecting…");
    }
  }, [accept, query, sessionId]);

  useEffect(() => {
    void reload();
  }, [reload, phase, stateJson]);

  const clocking =
    state != null &&
    state.phase !== "scoreboard" &&
    !(state.phase === "reveal" && state.revealStep === "outcome");

  // The arc animation is not the clock. An open screen keeps asking, so a
  // paused timer still closes a due turn and the reveal can reach the outcome.
  useEffect(() => {
    if (!clocking) return;
    const id = window.setInterval(() => {
      void reload();
    }, 2000);
    return () => window.clearInterval(id);
  }, [clocking, reload]);

  const send = useCallback(
    async (action: OtspSendAction): Promise<boolean> => {
      if (action.type === "expire" && inflight.current > 0) return false;
      inflight.current += 1;
      fetchGen.current += 1;
      const gen = fetchGen.current;
      setPending(true);
      setError(null);
      try {
        const res = await fetch(`/api/on-the-same-page/session/${sessionId}/action${query()}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action),
        });
        const body = (await res.json()) as { state?: OtspClientState | null; error?: string };
        if (gen !== fetchGen.current) return res.ok;
        if (!res.ok) {
          if (action.type !== "expire") setError(body.error ?? "Action failed.");
          return false;
        }
        if (body.state) accept(body.state);
        return true;
      } catch {
        if (action.type !== "expire") setError("Network error. Try again.");
        return false;
      } finally {
        inflight.current = Math.max(0, inflight.current - 1);
        if (inflight.current === 0) setPending(false);
      }
    },
    [accept, query, sessionId]
  );

  return { state, error, pending, send, reload, clockOffsetMs };
}
