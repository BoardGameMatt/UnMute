import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { advanceIfDue } from "./actions";
import { projectPlayState } from "./engine";
import { loadCatalog, loadRoster, loadSessionMeta, loadStoredGame } from "./store";
import type { OtspClientState } from "./types";

export async function loadOtspPlayState(input: {
  admin: SupabaseClient;
  sessionId: string;
  participantId: string;
  isDisplay: boolean;
  canControl: boolean;
  skipMaintenance?: boolean;
}): Promise<OtspClientState | null> {
  let stored = await loadStoredGame(input.admin, input.sessionId);
  if (!stored) return null;

  const meta = await loadSessionMeta(input.admin, input.sessionId);
  const catalog = await loadCatalog(input.admin, meta.contentPackId);

  if (!input.skipMaintenance) {
    const advanced = await advanceIfDue(input.admin, input.sessionId, stored, catalog);
    if (advanced) stored = advanced;
    else {
      const again = await loadStoredGame(input.admin, input.sessionId);
      if (again) stored = again;
    }
  }

  const roster = await loadRoster(input.admin, input.sessionId);
  const names = Object.fromEntries(roster.map((member) => [member.participantId, member.displayName]));
  const view = projectPlayState(
    stored.game,
    {
      participantId: input.participantId,
      isDisplay: input.isDisplay,
      canControl: input.canControl,
    },
    names,
    catalog
  );

  return { ...view, serverNow: Date.now(), sessionId: input.sessionId };
}
