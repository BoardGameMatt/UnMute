"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useGameState } from "@/components/providers/SessionProvider";
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
  const { phase, stateJson } = useGameState();
  const [state, setState] = useState<RankAndFilePlayState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [isDisplay, setIsDisplay] = useState(false);
  const inflight = useRef(0);
  const fetchGen = useRef(0);
  const timerRetry = useRef(0);
  const railBusy = useRef(false);
  const railQueued = useRef<(string | null)[] | null>(null);

  useEffect(() => {
    setIsDisplay(readDisplayPin(sessionId));
  }, [sessionId]);

  const reload = useCallback(async () => {
    if (inflight.current > 0 || railBusy.current || railQueued.current) return;
    const gen = fetchGen.current;
    const display = readDisplayPin(sessionId);
    const res = await fetch(
      `/api/rank-and-file/session/${sessionId}/play${display ? "?display=1" : ""}`
    );
    const body = (await res.json()) as { state?: RankAndFilePlayState; error?: string };
    if (gen !== fetchGen.current || inflight.current > 0 || railBusy.current || railQueued.current) {
      return;
    }
    if (!res.ok) {
      setError(body.error ?? "Could not load Rank and File.");
      return;
    }
    setError(null);
    if (body.state) setState(body.state);
  }, [sessionId]);

  useEffect(() => {
    void reload();
  }, [reload, phase, stateJson, isDisplay]);

  const postAction = useCallback(
    async (action: RankAndFileAction): Promise<{ ok: boolean; state?: RankAndFilePlayState }> => {
      inflight.current += 1;
      fetchGen.current += 1;
      const gen = fetchGen.current;
      setPending(true);
      setError(null);
      try {
        const display = readDisplayPin(sessionId);
        const res = await fetch(
          `/api/rank-and-file/session/${sessionId}/action${display ? "?display=1" : ""}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(action),
          }
        );
        const body = (await res.json()) as { state?: RankAndFilePlayState; error?: string };
        if (gen !== fetchGen.current) return { ok: false };
        if (!res.ok) {
          setError(body.error ?? "Action failed.");
          return { ok: false };
        }
        return { ok: true, state: body.state };
      } catch {
        setError("Network error. Try again.");
        return { ok: false };
      } finally {
        inflight.current = Math.max(0, inflight.current - 1);
        if (inflight.current === 0 && !railBusy.current && !railQueued.current) {
          setPending(false);
        }
      }
    },
    [sessionId]
  );

  const flushRail = useCallback(async () => {
    if (railBusy.current) return;
    railBusy.current = true;
    setPending(true);
    try {
      while (railQueued.current) {
        const dealIds = railQueued.current;
        railQueued.current = null;
        const result = await postAction({ type: "setRail", dealIds });
        if (!result.ok) {
          railQueued.current = null;
          inflight.current = 0;
          await reload();
          return;
        }
        const queued = railQueued.current;
        if (result.state) {
          setState(queued ? withOptimisticRail(result.state, queued) : result.state);
        }
      }
    } finally {
      railBusy.current = false;
      if (railQueued.current) {
        void flushRail();
        return;
      }
      if (inflight.current === 0) setPending(false);
    }
  }, [postAction, reload]);

  const send = useCallback(
    async (action: RankAndFileAction): Promise<boolean> => {
      if (action.type === "setRail") {
        setState((prev) => (prev ? withOptimisticRail(prev, action.dealIds) : prev));
        railQueued.current = action.dealIds;
        await flushRail();
        return true;
      }

      const result = await postAction(action);
      if (!result.ok) {
        inflight.current = 0;
        await reload();
        return false;
      }
      if (result.state) setState(result.state);
      if (action.type === "timerExpired" && result.state && result.state.phase === "write") {
        if (timerRetry.current < 6) {
          timerRetry.current += 1;
          window.setTimeout(() => {
            void send({ type: "timerExpired" });
          }, 400);
        }
      } else if (action.type === "timerExpired") {
        timerRetry.current = 0;
      }
      return true;
    },
    [flushRail, postAction, reload]
  );

  const pinDisplay = useCallback(
    (pinned: boolean) => {
      writeDisplayPin(sessionId, pinned);
      setIsDisplay(pinned);
    },
    [sessionId]
  );

  return { state, error, pending, send, reload, isDisplay, pinDisplay };
}
