import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/lib/types/database";
import type { TalkTrackEndReason, TalkTrackPhase, TalkTrackSubphase, TalkTrackWordOutcome } from "./types";

export type TalkTrackSessionRow = {
  session_id: string;
  phase: TalkTrackPhase;
  cycle_index: number;
  team_order: string[];
  next_team_index: number;
  current_turn_id: string | null;
  paused: boolean;
  hold_started_at: string | null;
  last_turn_points: number | null;
  last_turn_end_reason: TalkTrackEndReason | null;
};

export type TalkTrackTeamRow = {
  id: string;
  session_id: string;
  name: string;
  member_ids: string[];
  score: number;
  sort_index: number;
};

export type TalkTrackTurnRow = {
  id: string;
  session_id: string;
  team_id: string;
  cycle_index: number;
  card_id: string | null;
  guesser_id: string | null;
  train_ids: string[];
  current_slot: number;
  subphase: TalkTrackSubphase;
  started_at: string | null;
  ended_at: string | null;
  end_reason: TalkTrackEndReason | null;
};

export type TalkTrackWordRow = {
  id: string;
  turn_id: string;
  slot: number;
  outcome: TalkTrackWordOutcome;
  decided_by: string | null;
  decided_at: string | null;
};

export type TalkTrackCardRow = {
  id: string;
  content_pack_id: string;
  word_1: string;
  word_2: string;
  word_3: string;
  word_4: string;
  word_5: string;
  active: boolean;
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

  return (data ?? []).map((row) => {
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
}

export async function loadTalkTrackSession(
  admin: SupabaseClient,
  sessionId: string
): Promise<TalkTrackSessionRow | null> {
  const { data, error } = await admin
    .from("talk_track_sessions")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as TalkTrackSessionRow | null) ?? null;
}

export async function loadTeams(
  admin: SupabaseClient,
  sessionId: string
): Promise<TalkTrackTeamRow[]> {
  const { data, error } = await admin
    .from("talk_track_teams")
    .select("*")
    .eq("session_id", sessionId)
    .order("sort_index", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as TalkTrackTeamRow[]) ?? [];
}

export async function loadTurn(
  admin: SupabaseClient,
  turnId: string
): Promise<TalkTrackTurnRow | null> {
  const { data, error } = await admin
    .from("talk_track_turns")
    .select("*")
    .eq("id", turnId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as TalkTrackTurnRow | null) ?? null;
}

export async function loadWordResults(
  admin: SupabaseClient,
  turnId: string
): Promise<TalkTrackWordRow[]> {
  const { data, error } = await admin
    .from("talk_track_word_results")
    .select("*")
    .eq("turn_id", turnId)
    .order("slot", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as TalkTrackWordRow[]) ?? [];
}

export async function loadCard(
  admin: SupabaseClient,
  cardId: string
): Promise<TalkTrackCardRow | null> {
  const { data, error } = await admin
    .from("talk_track_cards")
    .select("*")
    .eq("id", cardId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as TalkTrackCardRow | null) ?? null;
}

export function cardWords(card: TalkTrackCardRow): [string, string, string, string, string] {
  return [card.word_1, card.word_2, card.word_3, card.word_4, card.word_5];
}

export async function syncPublicState(
  admin: SupabaseClient,
  sessionId: string,
  phase: TalkTrackPhase,
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
        talkTrack: { phase, ...extra, t: Date.now() },
      },
      updated_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId);
  if (error) throw new Error(error.message);
}

export async function remainingPlayableCards(
  admin: SupabaseClient,
  sessionId: string,
  packId: string
): Promise<number> {
  const { data: used, error: usedErr } = await admin
    .from("talk_track_turns")
    .select("card_id")
    .eq("session_id", sessionId)
    .not("card_id", "is", null);
  if (usedErr) throw new Error(usedErr.message);

  const usedIds = new Set((used ?? []).map((r) => r.card_id as string));

  const { data: cards, error: cardErr } = await admin
    .from("talk_track_cards")
    .select("id")
    .eq("content_pack_id", packId)
    .eq("active", true);
  if (cardErr) throw new Error(cardErr.message);

  return (cards ?? []).filter((c) => !usedIds.has(c.id as string)).length;
}

export async function resolvePackId(
  admin: SupabaseClient,
  sessionId: string
): Promise<string> {
  const { data: session, error } = await admin
    .from("sessions")
    .select("content_pack_id, protocol_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!session) throw new Error("Session not found.");
  if (session.content_pack_id) return session.content_pack_id as string;

  const { data: pack, error: packErr } = await admin
    .from("content_packs")
    .select("id")
    .eq("protocol_id", session.protocol_id)
    .eq("slug", "a")
    .eq("status", "active")
    .maybeSingle();
  if (packErr) throw new Error(packErr.message);
  if (!pack) throw new Error("Talk Track Pack A is not installed.");

  const { error: upErr } = await admin
    .from("sessions")
    .update({ content_pack_id: pack.id })
    .eq("id", sessionId);
  if (upErr) throw new Error(upErr.message);
  return pack.id as string;
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
