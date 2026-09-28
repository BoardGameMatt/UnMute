"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useGameState } from "@/components/providers/SessionProvider";
import type { TruthIsClientAction, TruthIsPlayState } from "./types";

export function useTruthIsPlay(sessionId: string) {
  const { phase, stateJson } = useGameState();
  const [state, setState] = useState<TruthIsPlayState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inflight = useRef(0);

  const reload = useCallback(async () => {
    if (inflight.current > 0) return;
    const res = await fetch(`/api/the-truth-is/session/${sessionId}/play`);
    const body = (await res.json()) as { state?: TruthIsPlayState; error?: string };
    if (!res.ok) {
      setError(body.error ?? "Could not load The Truth Is.");
      return;
    }
    setError(null);
    if (body.state) setState(body.state);
  }, [sessionId]);

  useEffect(() => {
    void reload();
  }, [reload, phase, stateJson]);

  const send = useCallback(
    async (action: TruthIsClientAction): Promise<boolean> => {
      inflight.current += 1;
      setPending(true);
      setError(null);
      let failed = false;
      try {
        const res = await fetch(`/api/the-truth-is/session/${sessionId}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action),
        });
        const body = (await res.json()) as { state?: TruthIsPlayState; error?: string };
        if (!res.ok) {
          setError(body.error ?? "Action failed.");
          failed = true;
          return false;
        }
        if (body.state) setState(body.state);
        return true;
      } catch {
        setError("Network error. Try again.");
        failed = true;
        return false;
      } finally {
        inflight.current = Math.max(0, inflight.current - 1);
        setPending(false);
        if (failed) {
          const res = await fetch(`/api/the-truth-is/session/${sessionId}/play`);
          const body = (await res.json()) as { state?: TruthIsPlayState; error?: string };
          if (res.ok && body.state) setState(body.state);
        }
      }
    },
    [sessionId]
  );

  return { state, error, pending, send, reload };
}
