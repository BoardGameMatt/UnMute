"use client";

import { useCallback, useMemo } from "react";
import { useRecoverablePlay } from "./useRecoverablePlay";

const INPUTS = new Set(["lockClue", "confirmGif", "lockGuess", "submitEntry", "submitOnTimeout", "submitVote", "choose", "place", "guess", "pin", "react", "lockZmAssignment", "lockLots", "lockTeam", "stop", "resolve", "lockAgency", "submitMissionReport", "submitGuess"]);
const EDITS = new Set(["setRail", "placeGuess", "placeTeamGuess", "selectLots", "preview"]);
type Envelope = { workshopContext?: string; workshopRevision?: number; serverNow?: string | number };

/** Shared recovery/outbox; the protocol still owns its screen and game actions. */
export function useWorkshopPlay<State, Action extends { type: string }>(
  protocol: string, sessionId: string, query = "", optimistic?: (state: State, action: Action) => State
) {
  const prepare = useCallback((state: State, action: Action): Action => {
    const envelope = state as State & Envelope;
    return { ...action, operationId: crypto.randomUUID(), workshopContext: envelope.workshopContext,
      ...(EDITS.has(action.type) ? { expectedRevision: envelope.workshopRevision } : {}) };
  }, []);
  const recoverable = useCallback((action: Action) => INPUTS.has(action.type), []);
  const play = useRecoverablePlay<State, Action>({ protocol, sessionId, query, prepare, recoverable, optimistic });
  const clockOffsetMs = useMemo(() => {
    const now = (play.state as (State & Envelope) | null)?.serverNow;
    return now === undefined ? 0 : new Date(now).getTime() - Date.now();
  }, [play.state]);
  return { ...play, clockOffsetMs };
}
