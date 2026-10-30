"use client";
import { useWorkshopPlay } from "@/hooks/useWorkshopPlay";
import type { TalkTrackAction, TalkTrackPlayState, TalkTrackWordOutcome } from "./types";
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
  return useWorkshopPlay<TalkTrackPlayState, TalkTrackAction>("talk-track", sessionId, "", applyOptimistic);
}
