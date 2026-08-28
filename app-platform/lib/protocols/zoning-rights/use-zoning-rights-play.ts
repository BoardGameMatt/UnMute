"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useGameState } from "@/components/providers/SessionProvider";
import type { ZoningRightsAction, ZoningRightsPlayState } from "./types";

const QUIET_ACTIONS = new Set<ZoningRightsAction["type"]>([
  "selectLots",
  "placeGuess",
  "placeTeamGuess",
]);

export function useZoningRightsPlay(sessionId: string) {
  const { phase, stateJson } = useGameState();
  const [state, setState] = useState<ZoningRightsPlayState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inflight = useRef(0);

  const reload = useCallback(async () => {
    if (inflight.current > 0) return;
    const res = await fetch(`/api/zoning-rights/session/${sessionId}/play`);
    const body = (await res.json()) as { state?: ZoningRightsPlayState; error?: string };
    if (!res.ok) {
      setError(body.error ?? "Could not load Zoning Rights.");
      return;
    }
    setError(null);
    if (body.state) setState(body.state);
  }, [sessionId]);

  useEffect(() => {
    void reload();
  }, [reload, phase, stateJson]);

  const send = useCallback(
    async (action: ZoningRightsAction): Promise<boolean> => {
      const quiet = QUIET_ACTIONS.has(action.type);
      if (!quiet) {
        inflight.current += 1;
        setPending(true);
      }
      setError(null);
      try {
        const res = await fetch(`/api/zoning-rights/session/${sessionId}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action),
        });
        const body = (await res.json()) as { state?: ZoningRightsPlayState; error?: string };
        if (!res.ok) {
          setError(body.error ?? "Action failed.");
          if (!quiet) await reload();
          return false;
        }
        if (body.state && !quiet) setState(body.state);
        return true;
      } catch {
        setError("Network error. Try again.");
        if (!quiet) await reload();
        return false;
      } finally {
        if (!quiet) {
          inflight.current = Math.max(0, inflight.current - 1);
          setPending(false);
        }
      }
    },
    [reload, sessionId]
  );

  return { state, error, pending, send, reload };
}
