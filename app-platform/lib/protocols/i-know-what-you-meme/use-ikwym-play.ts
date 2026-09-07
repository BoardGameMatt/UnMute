"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useGameState } from "@/components/providers/SessionProvider";
import type { IkwymAction, IkwymPlayState } from "./types";

export function useIkwymPlay(sessionId: string) {
  const { phase, stateJson } = useGameState();
  const [state, setState] = useState<IkwymPlayState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inflight = useRef(0);

  const reload = useCallback(async () => {
    if (inflight.current > 0) return;
    const res = await fetch(`/api/ikwym/session/${sessionId}/play`);
    const body = (await res.json()) as { state?: IkwymPlayState; error?: string };
    if (!res.ok) {
      setError(body.error ?? "Could not load I Know What You Meme.");
      return;
    }
    setError(null);
    if (body.state) setState(body.state);
  }, [sessionId]);

  useEffect(() => {
    void reload();
  }, [reload, phase, stateJson]);

  const send = useCallback(
    async (action: IkwymAction): Promise<boolean> => {
      inflight.current += 1;
      setPending(true);
      setError(null);
      try {
        const res = await fetch(`/api/ikwym/session/${sessionId}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action),
        });
        const body = (await res.json()) as { state?: IkwymPlayState; error?: string };
        if (!res.ok) {
          setError(body.error ?? "Action failed.");
          await reload();
          return false;
        }
        if (body.state) setState(body.state);
        return true;
      } catch {
        setError("Network error. Try again.");
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
