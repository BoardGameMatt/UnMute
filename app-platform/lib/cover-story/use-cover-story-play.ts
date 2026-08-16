"use client";

import { useCallback, useEffect, useState } from "react";
import type { CoverStoryAction } from "@/lib/cover-story/types";
import type { CoverStoryPlayState } from "@/lib/cover-story/types";
import { useGameState } from "@/components/providers/SessionProvider";

export function useCoverStoryPlay(sessionId: string) {
  const { phase, stateJson } = useGameState();
  const [state, setState] = useState<CoverStoryPlayState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/cover-story/session/${sessionId}/play`);
    const body = (await res.json()) as { state?: CoverStoryPlayState; error?: string };
    if (!res.ok) {
      setError(body.error ?? "Could not load Cover Story.");
      return;
    }
    setError(null);
    if (body.state) setState(body.state);
  }, [sessionId]);

  useEffect(() => {
    void reload();
  }, [reload, phase, stateJson]);

  useEffect(() => {
    if (state?.phase !== "reveal") return;
    if (state.reveal?.subphase !== "guess" && state.reveal?.subphase !== "mission") return;
    const id = window.setInterval(() => {
      void reload();
    }, 1000);
    return () => window.clearInterval(id);
  }, [reload, state?.phase, state?.reveal?.subphase]);

  const send = useCallback(
    async (action: CoverStoryAction): Promise<boolean> => {
      setPending(true);
      setError(null);
      try {
        const res = await fetch(`/api/cover-story/session/${sessionId}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action),
        });
        const body = (await res.json()) as { state?: CoverStoryPlayState; error?: string };
        if (!res.ok) {
          setError(body.error ?? "Action failed.");
          return false;
        }
        if (body.state) setState(body.state);
        return true;
      } catch {
        setError("Network error. Try again.");
        return false;
      } finally {
        setPending(false);
      }
    },
    [sessionId]
  );

  return { state, error, pending, send, reload };
}
