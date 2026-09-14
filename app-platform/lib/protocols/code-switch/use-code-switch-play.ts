"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useGameState } from "@/components/providers/SessionProvider";
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

export function useCodeSwitchPlay(sessionId: string) {
  const { phase, stateJson } = useGameState();
  const [state, setState] = useState<CodeSwitchPlayState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [isDisplay, setIsDisplay] = useState(false);
  const inflight = useRef(0);
  const fetchGen = useRef(0);
  const timerRetry = useRef(0);

  useEffect(() => {
    setIsDisplay(readDisplayPin(sessionId));
  }, [sessionId]);

  const reload = useCallback(async () => {
    if (inflight.current > 0) return;
    const gen = fetchGen.current;
    const display = readDisplayPin(sessionId);
    const res = await fetch(
      `/api/code-switch/session/${sessionId}/play${display ? "?display=1" : ""}`
    );
    const body = (await res.json()) as { state?: CodeSwitchPlayState; error?: string };
    if (gen !== fetchGen.current || inflight.current > 0) return;
    if (!res.ok) {
      setError(body.error ?? "Could not load SwitchCode.");
      return;
    }
    setError(null);
    if (body.state) setState(body.state);
  }, [sessionId]);

  useEffect(() => {
    void reload();
  }, [reload, phase, stateJson, isDisplay]);

  const send = useCallback(
    async (action: CodeSwitchAction): Promise<boolean> => {
      inflight.current += 1;
      fetchGen.current += 1;
      const gen = fetchGen.current;
      setPending(true);
      setError(null);
      try {
        const display = readDisplayPin(sessionId);
        const res = await fetch(
          `/api/code-switch/session/${sessionId}/action${display ? "?display=1" : ""}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(action),
          }
        );
        const body = (await res.json()) as { state?: CodeSwitchPlayState; error?: string };
        if (gen !== fetchGen.current) return false;
        if (!res.ok) {
          setError(body.error ?? "Action failed.");
          inflight.current = 0;
          await reload();
          return false;
        }
        if (body.state) setState(body.state);
        if (
          action.type === "timerExpired" &&
          body.state &&
          (body.state.phase === "write" || body.state.phase === "guess")
        ) {
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
      } catch {
        setError("Network error. Try again.");
        inflight.current = 0;
        await reload();
        return false;
      } finally {
        inflight.current = Math.max(0, inflight.current - 1);
        setPending(false);
      }
    },
    [reload, sessionId]
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
