"use client";
import { useWorkshopPlay } from "@/hooks/useWorkshopPlay";
import type { IkwymAction, IkwymPlayState } from "./types";
export function useIkwymPlay(sessionId: string) {
  return useWorkshopPlay<IkwymPlayState, IkwymAction>("ikwym", sessionId);
}
