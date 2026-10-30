"use client";

import { useRecoverablePlay } from "@/hooks/useRecoverablePlay";
import type { SayLessAction, SayLessPlayState } from "./types";

const prepare = (state: SayLessPlayState, action: SayLessAction): SayLessAction =>
  action.type === "cardAction" ? { ...action, operationId: crypto.randomUUID(),
    turnId: state.turnId, expectedVersion: state.version } : action.type === "advance" ? action
    : { ...action, turnId: state.turnId, expectedVersion: state.version };
const recoverable = (action: SayLessAction) => action.type === "cardAction" &&
  typeof action.operationId === "string" && typeof action.turnId === "string" &&
  Number.isInteger(action.expectedVersion);

export function useSayLessPlay(sessionId: string) {
  return useRecoverablePlay<SayLessPlayState, SayLessAction>({
    protocol: "say-less", sessionId, prepare, recoverable,
  });
}
