import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toPlayState } from "./project";
import { loadSessionStatus, loadTruthIsState } from "./store";
import { expireIfNeeded } from "./actions";
import type { TruthIsPlayState } from "./types";

export async function buildTruthIsPlayState(input: {
  admin: SupabaseClient;
  sessionId: string;
  participantId: string;
  isLead: boolean;
  skipMaintenance?: boolean;
}): Promise<TruthIsPlayState> {
  const { admin, sessionId, participantId, isLead } = input;
  if (!input.skipMaintenance) {
    await expireIfNeeded(admin, sessionId);
  }

  const state = await loadTruthIsState(admin, sessionId);
  if (!state) {
    throw new Error("The Truth Is has not started.");
  }

  const status = await loadSessionStatus(admin, sessionId);
  return toPlayState(state, participantId, isLead, status === "completed");
}
