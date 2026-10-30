"use client";
import { useWorkshopPlay } from "@/hooks/useWorkshopPlay";
import type { CoverStoryAction, CoverStoryPlayState } from "./types";
export function useCoverStoryPlay(sessionId: string) {
  return useWorkshopPlay<CoverStoryPlayState, CoverStoryAction>("cover-story", sessionId);
}
