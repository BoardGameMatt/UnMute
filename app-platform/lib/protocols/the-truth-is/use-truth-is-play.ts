"use client";
import { useWorkshopPlay } from "@/hooks/useWorkshopPlay";
import type { TruthIsClientAction, TruthIsPlayState } from "./types";
export function useTruthIsPlay(sessionId: string) {
  return useWorkshopPlay<TruthIsPlayState, TruthIsClientAction>("the-truth-is", sessionId);
}
