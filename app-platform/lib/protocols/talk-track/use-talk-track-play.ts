"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useGameState } from "@/components/providers/SessionProvider";
import type { TalkTrackAction, TalkTrackPlayState, TalkTrackWordOutcome } from "./types";

/** Drop a fetch that arrived after we already moved the turn forward. */
function isStaleArrival(
  local: TalkTrackPlayState,
  incoming: TalkTrackPlayState
): boolean {
  if (!local.turn || !incoming.turn) return false;
  if (incoming.turn.slot < local.turn.slot) return true;
  if (
    incoming.turn.slot === local.turn.slot &&
    local.turn.subphase === "guessing" &&
    incoming.turn.subphase === "cluing"
  ) {
    return true;
  }
  if (local.turn.words && incoming.turn.words) {
    const reverted = local.turn.words.some((word) => {
      if (word.outcome === "unset") return false;
      const incomingWord = incoming.turn!.words?.find((row) => row.slot === word.slot);
      return incomingWord?.outcome === "unset";
    });
    if (reverted) return true;
  }
  return false;
}

function applyOptimistic(
  prev: TalkTrackPlayState,
  action: TalkTrackAction
): TalkTrackPlayState {
  if (!prev.turn) return prev;
  if (action.type === "stop") {
    return {
      ...prev,
      turn: {
        ...prev.turn,
        subphase: "guessing",
        canStop: false,
        canResolve: prev.viewerRole === "train",
      },
    };
  }
  if (action.type === "resolve" && prev.turn.words) {
    const slot = prev.turn.slot;
    const outcome: TalkTrackWordOutcome =
      action.outcome === "got_it" ? "scored" : "passed";
    const words = prev.turn.words.map((word) =>
      word.slot === slot ? { ...word, outcome } : word
    );
    if (slot >= 5) return prev;
    return {
      ...prev,
      turn: {
        ...prev.turn,
        words,
        slot: slot + 1,
        subphase: "cluing",
        canStop: prev.viewerRole === "train",
        canResolve: false,
      },
    };
  }
  return prev;
}

export function useTalkTrackPlay(sessionId: string) {
  const { phase, stateJson } = useGameState();
  const [state, setState] = useState<TalkTrackPlayState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const appliedAt = useRef(0);
  const inflight = useRef(0);
  const fetchGen = useRef(0);

  const reload = useCallback(async () => {
    if (inflight.current > 0) return;
    if (Date.now() - appliedAt.current < 1500) return;
    const gen = fetchGen.current;
    const res = await fetch(`/api/talk-track/session/${sessionId}/play`);
    const body = (await res.json()) as { state?: TalkTrackPlayState; error?: string };
    if (gen !== fetchGen.current || inflight.current > 0) return;
    if (!res.ok) {
      setError(body.error ?? "Could not load Talk Track.");
      return;
    }
    setError(null);
    if (body.state) {
      setState((prev) => {
        if (prev && isStaleArrival(prev, body.state!)) return prev;
        return body.state!;
      });
    }
  }, [sessionId]);

  useEffect(() => {
    void reload();
  }, [reload, phase, stateJson]);

  const send = useCallback(
    async (action: TalkTrackAction): Promise<boolean> => {
      const fast = action.type === "stop" || action.type === "resolve";
      inflight.current += 1;
      fetchGen.current += 1;
      const gen = fetchGen.current;
      if (fast) {
        appliedAt.current = Date.now();
        setState((prev) => (prev ? applyOptimistic(prev, action) : prev));
      } else {
        setPending(true);
      }
      setError(null);
      try {
        const res = await fetch(`/api/talk-track/session/${sessionId}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action),
        });
        const body = (await res.json()) as { state?: TalkTrackPlayState; error?: string };
        if (gen !== fetchGen.current) return false;
        if (!res.ok) {
          setError(body.error ?? "Action failed.");
          appliedAt.current = 0;
          inflight.current = 0;
          await reload();
          return false;
        }
        appliedAt.current = Date.now();
        if (body.state) {
          setState((prev) => {
            if (prev && isStaleArrival(prev, body.state!)) return prev;
            return body.state!;
          });
        }
        return true;
      } catch {
        setError("Network error. Try again.");
        appliedAt.current = 0;
        inflight.current = 0;
        await reload();
        return false;
      } finally {
        inflight.current = Math.max(0, inflight.current - 1);
        if (!fast) setPending(false);
      }
    },
    [reload, sessionId]
  );

  return { state, error, pending, send, reload };
}
