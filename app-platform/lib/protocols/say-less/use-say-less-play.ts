"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useGameState } from "@/components/providers/SessionProvider";
import type { SayLessAction, SayLessPlayState } from "./types";

export function useSayLessPlay(sessionId: string) {
  const { phase, stateJson } = useGameState();
  const [state, setState] = useState<SayLessPlayState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inflight = useRef(0);
  const fetchGen = useRef(0);

  const reload = useCallback(async () => {
    if (inflight.current > 0) return;
    const gen = fetchGen.current;
    try {
      const res = await fetch(`/api/say-less/session/${sessionId}/play`, { cache: "no-store" });
      const body = (await res.json()) as { state?: SayLessPlayState; error?: string };
      if (gen !== fetchGen.current || inflight.current > 0) return;
      if (!res.ok) {
        setError(body.error ?? "Could not load Say Less.");
        return;
      }
      setError(null);
      if (body.state) setState(body.state);
    } catch {
      setError("Network error. Reconnecting…");
    }
  }, [sessionId]);

  useEffect(() => {
    void reload();
  }, [reload, phase, stateJson]);

  const clocking =
    state != null &&
    !state.paused &&
    (state.phase === "preview" || state.phase === "turn" || state.phase === "hold");

  useEffect(() => {
    if (!clocking) return;
    const id = window.setInterval(() => {
      void reload();
    }, 2500);
    return () => window.clearInterval(id);
  }, [clocking, reload]);

  const send = useCallback(
    async (action: SayLessAction): Promise<boolean> => {
      inflight.current += 1;
      fetchGen.current += 1;
      const gen = fetchGen.current;
      setPending(true);
      setError(null);
      try {
        const res = await fetch(`/api/say-less/session/${sessionId}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action),
        });
        const body = (await res.json()) as { state?: SayLessPlayState; error?: string };
        if (gen !== fetchGen.current) return false;
        if (!res.ok) {
          setError(body.error ?? "Action failed.");
          inflight.current = 0;
          await reload();
          return false;
        }
        if (body.state) setState(body.state);
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

  return { state, error, pending, send, reload };
}
