"use client";
import { useWorkshopPlay } from "@/hooks/useWorkshopPlay";
import type { ZoningRightsAction, ZoningRightsPlayState } from "./types";
export function useZoningRightsPlay(sessionId: string) {
  return useWorkshopPlay<ZoningRightsPlayState, ZoningRightsAction>("zoning-rights", sessionId);
}
