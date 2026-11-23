import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveSessionContentPackId } from "@/lib/content-packs/session-pack";
import { isSharedScreenName } from "@/lib/protocols/rank-and-file/engine";
import type { Json } from "@/lib/types/database";
import type {
  SayLessCategoryId,
  SayLessEndReason,
  SayLessPhase,
  SayLessTeamLabel,
} from "./engine";
import { SAY_LESS_DEFAULT_CATEGORIES } from "./engine";

export type SayLessSessionRow = {
  session_id: string;
  phase: SayLessPhase;
  category_a: SayLessCategoryId;
  category_b: SayLessCategoryId;
  deck_card_ids: string[];
  round: 1 | 2;
  pile_card_ids: string[];
  first_team: SayLessTeamLabel;
  next_team: SayLessTeamLabel;
  cursor_a: number;
  cursor_b: number;
  current_turn_id: string | null;
  phase_deadline: string | null;
  hold_started_at: string | null;
  paused: boolean;
  version: number;
  last_turn_got_it: number | null;
  last_turn_end_reason: SayLessEndReason | null;
  round_1_ended_early: boolean;
  round_2_ended_early: boolean;
};

export type SayLessTeamRow = {
  id: string;
  session_id: string;
  label: SayLessTeamLabel;
  member_ids: string[];
};

export type SayLessTurnRow = {
  id: string;
  session_id: string;
  round: 1 | 2;
  team_id: string;
  clue_giver_id: string;
  started_at: string | null;
  ended_at: string | null;
  end_reason: SayLessEndReason | null;
};

export type SayLessCardRow = {
  id: string;
  content_pack_id: string;
  category: SayLessCategoryId;
  name: string;
  hint: string;
  active: boolean;
};

export type SayLessEventRow = {
  id: string;
  turn_id: string;
  card_id: string;
  outcome: "got_it" | "pass" | "oops" | "expired";
  at: string;
};

export type RosterMember = {
  participantId: string;
  displayName: string;
  isLead: boolean;
  connected: boolean;
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

  const roster = (data ?? []).map((row) => {
    const nested = row.participants as
      | { display_name?: string }
      | { display_name?: string }[]
      | null;
    const person = Array.isArray(nested) ? nested[0] : nested;
    return {
      participantId: row.participant_id as string,
      displayName: person?.display_name ?? "Player",
      isLead: row.role_in_session === "lead",
      connected: Boolean(row.connected),
    };
  });
  return roster.filter((row) => !isSharedScreenName(row.displayName));
}

export async function loadSayLessSession(
  admin: SupabaseClient,
  sessionId: string
): Promise<SayLessSessionRow | null> {
  const { data, error } = await admin
    .from("say_less_sessions")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SayLessSessionRow | null) ?? null;
}

export async function loadTeams(
  admin: SupabaseClient,
  sessionId: string
): Promise<SayLessTeamRow[]> {
  const { data, error } = await admin
    .from("say_less_teams")
    .select("*")
    .eq("session_id", sessionId)
    .order("label", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as SayLessTeamRow[]) ?? [];
}

export async function loadTurn(
  admin: SupabaseClient,
  turnId: string
): Promise<SayLessTurnRow | null> {
  const { data, error } = await admin
    .from("say_less_turns")
    .select("*")
    .eq("id", turnId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SayLessTurnRow | null) ?? null;
}

export async function loadTurns(
  admin: SupabaseClient,
  sessionId: string
): Promise<SayLessTurnRow[]> {
  const { data, error } = await admin
    .from("say_less_turns")
    .select("*")
    .eq("session_id", sessionId);
  if (error) throw new Error(error.message);
  return (data as SayLessTurnRow[]) ?? [];
}

export async function loadEventsForTurns(
  admin: SupabaseClient,
  turnIds: string[]
): Promise<SayLessEventRow[]> {
  if (turnIds.length === 0) return [];
  const { data, error } = await admin
    .from("say_less_card_events")
    .select("*")
    .in("turn_id", turnIds);
  if (error) throw new Error(error.message);
  return (data as SayLessEventRow[]) ?? [];
}

export async function loadCard(
  admin: SupabaseClient,
  cardId: string
): Promise<SayLessCardRow | null> {
  const { data, error } = await admin
    .from("say_less_cards")
    .select("id, content_pack_id, category, name, hint, active")
    .eq("id", cardId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SayLessCardRow | null) ?? null;
}

export async function loadCardsByIds(
  admin: SupabaseClient,
  cardIds: string[]
): Promise<SayLessCardRow[]> {
  if (cardIds.length === 0) return [];
  const { data, error } = await admin
    .from("say_less_cards")
    .select("id, content_pack_id, category, name, hint, active")
    .in("id", cardIds);
  if (error) throw new Error(error.message);
  return (data as SayLessCardRow[]) ?? [];
}

export async function loadActiveCards(
  admin: SupabaseClient,
  packId: string
): Promise<SayLessCardRow[]> {
  const { data, error } = await admin
    .from("say_less_cards")
    .select("id, content_pack_id, category, name, hint, active")
    .eq("content_pack_id", packId)
    .eq("active", true);
  if (error) throw new Error(error.message);
  return (data as SayLessCardRow[]) ?? [];
}

export async function loadPreviewCardIds(
  admin: SupabaseClient,
  sessionId: string,
  participantId: string
): Promise<string[] | null> {
  const { data, error } = await admin
    .from("say_less_previews")
    .select("card_ids")
    .eq("session_id", sessionId)
    .eq("participant_id", participantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.card_ids as string[] | undefined) ?? null;
}

export async function resolvePackId(
  admin: SupabaseClient,
  sessionId: string
): Promise<string> {
  const result = await resolveSessionContentPackId(admin, sessionId);
  if (!result.ok) throw new Error(result.error);
  return result.contentPackId;
}

export async function ensureLobbyRow(
  admin: SupabaseClient,
  sessionId: string
): Promise<SayLessSessionRow> {
  const existing = await loadSayLessSession(admin, sessionId);
  if (existing) return existing;

  const { error } = await admin.from("say_less_sessions").insert({
    session_id: sessionId,
    phase: "lobby",
    category_a: SAY_LESS_DEFAULT_CATEGORIES[0],
    category_b: SAY_LESS_DEFAULT_CATEGORIES[1],
  });
  if (error && !error.message.toLowerCase().includes("duplicate")) {
    throw new Error(error.message);
  }
  const row = await loadSayLessSession(admin, sessionId);
  if (!row) throw new Error("Could not open Say Less.");
  return row;
}

export async function syncPublicState(
  admin: SupabaseClient,
  sessionId: string,
  phase: SayLessPhase,
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
        sayLess: { phase, ...extra, t: Date.now() },
      },
      updated_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId);
  if (error) throw new Error(error.message);
}

export function connectedMap(roster: RosterMember[]): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const row of roster) map[row.participantId] = row.connected;
  return map;
}

export function displayNameMap(roster: RosterMember[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of roster) map[row.participantId] = row.displayName;
  return map;
}
