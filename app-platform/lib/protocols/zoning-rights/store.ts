import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveSessionContentPackId } from "@/lib/content-packs/session-pack";
import type { Json } from "@/lib/types/database";
import { livePoolIds } from "./engine";
import type { ZoningBoard, ZoningRightsMode, ZoningRightsPhase } from "./types";

export type RosterMember = {
  participantId: string;
  displayName: string;
  role: "lead" | "member";
  connected: boolean;
};

export type ZoningRightsSessionRow = {
  session_id: string;
  phase: ZoningRightsPhase;
  mode: ZoningRightsMode;
  individual_round_index: number;
  team_round_index: number;
  current_round_id: string | null;
  board_json: ZoningBoard;
};

export type ZoningRightsRoundRow = {
  id: string;
  session_id: string;
  mode: ZoningRightsMode;
  round_index: number;
  planner_id: string | null;
  zm_id: string | null;
  lead_developer_id: string | null;
  k: number;
  lots_json: Json;
  building_ids: string[];
  zm_assignment_json: Json | null;
  team_guess_json: Json | null;
  guess_started_at: string | null;
  discuss_started_at: string | null;
  intro_started_at: string | null;
  ended_at: string | null;
  end_reason: string | null;
};

export type ZoningRightsGuessRow = {
  id: string;
  round_id: string;
  participant_id: string;
  assignment_json: Json;
  locked_at: string | null;
  is_exact: boolean | null;
};

export type ZoningRightsBuildingRow = {
  id: string;
  content_pack_id: string;
  name: string;
  active: boolean;
};

export async function loadRoster(
  admin: SupabaseClient,
  sessionId: string
): Promise<RosterMember[]> {
  const { data, error } = await admin
    .from("session_participants")
    .select("participant_id, role_in_session, connected, participants ( display_name )")
    .eq("session_id", sessionId);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const person = row.participants as { display_name?: string } | { display_name?: string }[] | null;
    const name = Array.isArray(person) ? person[0]?.display_name : person?.display_name;
    return {
      participantId: row.participant_id as string,
      displayName: name?.trim() || "Player",
      role: row.role_in_session as "lead" | "member",
      connected: Boolean(row.connected),
    };
  });
}

export function displayNameMap(roster: RosterMember[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of roster) map[row.participantId] = row.displayName;
  return map;
}

export function leadId(roster: RosterMember[]): string | null {
  return roster.find((r) => r.role === "lead")?.participantId ?? null;
}

export async function loadZoningSession(
  admin: SupabaseClient,
  sessionId: string
): Promise<ZoningRightsSessionRow | null> {
  const { data, error } = await admin
    .from("zoning_rights_sessions")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    session_id: data.session_id as string,
    phase: data.phase as ZoningRightsPhase,
    mode: data.mode as ZoningRightsMode,
    individual_round_index: data.individual_round_index as number,
    team_round_index: data.team_round_index as number,
    current_round_id: (data.current_round_id as string | null) ?? null,
    board_json: (data.board_json as ZoningBoard) ?? { occupants: {} },
  };
}

export async function loadRound(
  admin: SupabaseClient,
  roundId: string
): Promise<ZoningRightsRoundRow | null> {
  const { data, error } = await admin
    .from("zoning_rights_rounds")
    .select("*")
    .eq("id", roundId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as unknown as ZoningRightsRoundRow;
}

export async function loadRounds(
  admin: SupabaseClient,
  sessionId: string
): Promise<ZoningRightsRoundRow[]> {
  const { data, error } = await admin
    .from("zoning_rights_rounds")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ZoningRightsRoundRow[];
}

export async function loadGuesses(
  admin: SupabaseClient,
  roundId: string
): Promise<ZoningRightsGuessRow[]> {
  const { data, error } = await admin
    .from("zoning_rights_guesses")
    .select("*")
    .eq("round_id", roundId);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ZoningRightsGuessRow[];
}

export async function loadBuildingsByIds(
  admin: SupabaseClient,
  ids: string[]
): Promise<ZoningRightsBuildingRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await admin
    .from("zoning_rights_buildings")
    .select("*")
    .in("id", ids);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ZoningRightsBuildingRow[];
}

export async function loadActiveBuildings(
  admin: SupabaseClient,
  packId: string
): Promise<ZoningRightsBuildingRow[]> {
  const { data, error } = await admin
    .from("zoning_rights_buildings")
    .select("*")
    .eq("content_pack_id", packId)
    .eq("active", true);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ZoningRightsBuildingRow[];
}

export async function resolvePackId(
  admin: SupabaseClient,
  sessionId: string
): Promise<string> {
  const result = await resolveSessionContentPackId(admin, sessionId);
  if (!result.ok) throw new Error(result.error);
  return result.contentPackId;
}

export async function syncPublicState(
  admin: SupabaseClient,
  sessionId: string,
  phase: ZoningRightsPhase,
  extra: Record<string, Json> = {}
): Promise<void> {
  const { data: row, error: readErr } = await admin
    .from("session_state")
    .select("state_json")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);

  const current = (row?.state_json ?? {}) as Record<string, Json | undefined>;
  const { error } = await admin
    .from("session_state")
    .update({
      phase,
      state_json: {
        ...current,
        zoningRights: { phase, ...extra, t: Date.now() },
      },
      updated_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId);
  if (error) throw new Error(error.message);
}

export function connectedIds(roster: RosterMember[]): string[] {
  return livePoolIds(
    roster.map((row) => ({ id: row.participantId, connected: row.connected }))
  );
}
