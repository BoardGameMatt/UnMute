import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/lib/types/database";
import { resolveSessionContentPackId } from "@/lib/content-packs/session-pack";
import { isSharedScreenName } from "@/lib/protocols/rank-and-file/engine";
import { displayLap } from "./engine";
import type { Family, Picture } from "./pictures";
import type { EngineEvent, OtspGame, OtspPhase } from "./types";

export type RosterMember = {
  participantId: string;
  displayName: string;
  isLead: boolean;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isOtspGame(value: unknown): value is OtspGame {
  if (!value || typeof value !== "object") return false;
  const game = value as Partial<OtspGame>;
  return Array.isArray(game.playerIds) && typeof game.phase === "string" && !!game.round && typeof game.round === "object";
}

export async function loadRoster(admin: SupabaseClient, sessionId: string): Promise<RosterMember[]> {
  const { data, error } = await admin
    .from("session_participants")
    .select("participant_id, role_in_session, participants ( display_name )")
    .eq("session_id", sessionId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const person = row.participants as { display_name?: string } | { display_name?: string }[] | null;
    const displayName = Array.isArray(person) ? person[0]?.display_name : person?.display_name;
    return {
      participantId: row.participant_id as string,
      displayName: displayName ?? "Player",
      isLead: row.role_in_session === "lead",
    };
  });
}

export function playersOf(roster: RosterMember[]): RosterMember[] {
  return roster.filter((row) => !isSharedScreenName(row.displayName));
}

export async function loadSessionMeta(
  admin: SupabaseClient,
  sessionId: string
): Promise<{ teamId: string; contentPackId: string }> {
  const { data, error } = await admin.from("sessions").select("team_id").eq("id", sessionId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.team_id) throw new Error("Session not found.");
  const pack = await resolveSessionContentPackId(admin, sessionId);
  if (!pack.ok) throw new Error(pack.error);
  return { teamId: data.team_id as string, contentPackId: pack.contentPackId };
}

export async function loadCatalog(admin: SupabaseClient, contentPackId: string): Promise<Picture[]> {
  const { data, error } = await admin
    .from("otsp_pictures")
    .select("slug, label, family, starter")
    .eq("content_pack_id", contentPackId)
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.slug as string,
    label: row.label as string,
    family: row.family as Family,
    starter: Boolean(row.starter),
  }));
}

export async function loadUsedPictureIds(admin: SupabaseClient, teamId: string): Promise<string[]> {
  const { data: sessions, error } = await admin.from("sessions").select("id").eq("team_id", teamId);
  if (error) throw new Error(error.message);
  const ids = (sessions ?? []).map((row) => row.id as string);
  if (ids.length === 0) return [];
  const { data: rounds, error: roundErr } = await admin.from("otsp_rounds").select("picture_slug").in("session_id", ids);
  if (roundErr) throw new Error(roundErr.message);
  return Array.from(new Set((rounds ?? []).map((row) => row.picture_slug as string)));
}

export async function loadDebtIds(admin: SupabaseClient, teamId: string): Promise<string[]> {
  const { data, error } = await admin.from("otsp_rotation_debt").select("participant_id").eq("team_id", teamId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.participant_id as string);
}

export async function writeRotationDebt(
  admin: SupabaseClient,
  teamId: string,
  drawnIds: readonly string[],
  undrawnIds: readonly string[]
): Promise<void> {
  if (drawnIds.length > 0) {
    const { error } = await admin.from("otsp_rotation_debt").delete().eq("team_id", teamId).in("participant_id", [...drawnIds]);
    if (error) throw new Error(error.message);
  }
  if (undrawnIds.length === 0) return;
  const { error } = await admin.from("otsp_rotation_debt").upsert(
    undrawnIds.map((participantId) => ({
      team_id: teamId,
      participant_id: participantId,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "team_id,participant_id" }
  );
  if (error) throw new Error(error.message);
}

export type StoredGame = { version: number; game: OtspGame };

export async function loadStoredGame(admin: SupabaseClient, sessionId: string): Promise<StoredGame | null> {
  const { data, error } = await admin
    .from("otsp_sessions")
    .select("version, game_json")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  if (!isOtspGame(data.game_json)) throw new Error("On the Same Page state is unreadable.");
  return { version: data.version as number, game: data.game_json };
}

export async function insertSessionGame(admin: SupabaseClient, sessionId: string, game: OtspGame): Promise<void> {
  const { error } = await admin.from("otsp_sessions").insert({
    session_id: sessionId,
    phase: game.phase,
    version: 0,
    game_json: game as unknown as Json,
  });
  if (error) throw new Error(error.message);
}

/** Returns false when another write won the version. */
export async function saveGame(admin: SupabaseClient, sessionId: string, version: number, game: OtspGame): Promise<boolean> {
  const { data, error } = await admin
    .from("otsp_sessions")
    .update({
      phase: game.phase,
      version: version + 1,
      game_json: game as unknown as Json,
    })
    .eq("session_id", sessionId)
    .eq("version", version)
    .select("version")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function insertRound(admin: SupabaseClient, sessionId: string, game: OtspGame): Promise<void> {
  const { error } = await admin.from("otsp_rounds").upsert(
    {
      session_id: sessionId,
      round_number: game.roundNumber,
      picture_slug: game.round.pictureId,
      family: game.round.family,
      seed: game.round.seed,
    },
    { onConflict: "session_id,round_number" }
  );
  if (error) throw new Error(error.message);
}

export async function insertEvents(
  admin: SupabaseClient,
  sessionId: string,
  roundNumber: number,
  events: EngineEvent[]
): Promise<void> {
  if (events.length === 0) return;
  const { error } = await admin.from("otsp_events").insert(
    events.map((item) => ({
      session_id: sessionId,
      round_number: roundNumber,
      type: item.type,
      actor_id: item.actorId && UUID_RE.test(item.actorId) ? item.actorId : null,
      actor_role: item.role,
      payload_json: item.payload as unknown as Json,
    }))
  );
  if (error) throw new Error(error.message);
}

export async function syncPublicState(admin: SupabaseClient, sessionId: string, game: OtspGame): Promise<void> {
  const { data: row, error: readErr } = await admin.from("session_state").select("state_json").eq("session_id", sessionId).maybeSingle();
  if (readErr) throw new Error(readErr.message);
  const current = (row?.state_json ?? {}) as Record<string, Json | undefined>;
  const phase: OtspPhase = game.phase;
  const { error } = await admin
    .from("session_state")
    .update({
      phase,
      state_json: {
        ...current,
        otsp: { phase, round: game.roundNumber, lap: displayLap(game), t: Date.now() },
      },
      updated_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId);
  if (error) throw new Error(error.message);
}

export async function resetOnTheSamePageRows(admin: SupabaseClient, sessionId: string): Promise<void> {
  for (const table of ["otsp_events", "otsp_rounds", "otsp_sessions"]) {
    const { error } = await admin.from(table).delete().eq("session_id", sessionId);
    if (error) throw new Error(error.message);
  }
}

export async function completeSession(admin: SupabaseClient, sessionId: string): Promise<void> {
  const { error } = await admin
    .from("sessions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (error) throw new Error(error.message);
}
