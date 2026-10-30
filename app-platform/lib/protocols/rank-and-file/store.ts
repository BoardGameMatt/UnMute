import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveSessionContentPackId } from "@/lib/content-packs/session-pack";
import type { Json } from "@/lib/types/database";
import type { SubjectCategory } from "./engine";
import type { RankAndFileEndReason, RankAndFilePhase } from "./types";

export type RosterMember = {
  participantId: string;
  displayName: string;
  isLead: boolean;
  connected: boolean;
};

export type RankAndFileSessionRow = {
  session_id: string;
  phase: RankAndFilePhase;
  round_index: number;
  current_round_id: string | null;
  hits: number;
  committed_rounds: number;
};

export type RankAndFileRoundRow = {
  id: string;
  session_id: string;
  round_index: number;
  subject_id: string;
  k: number;
  write_started_at: string | null;
  rank_started_at: string | null;
  committed_at: string | null;
  rail_order_json: (string | null)[];
  is_hit: boolean | null;
  ended_at: string | null;
  end_reason: RankAndFileEndReason | null;
};

export type RankAndFileDealRow = {
  id: string;
  round_id: string;
  participant_id: string;
  dealt_number: number;
  clue_text: string | null;
  locked_at: string | null;
};

export type RankAndFileSubjectRow = {
  id: string;
  content_pack_id: string;
  pack_index: number;
  theme: string;
  low_end: string;
  high_end: string;
  category: SubjectCategory;
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
    const displayName = Array.isArray(person)
      ? person[0]?.display_name
      : person?.display_name;
    return {
      participantId: row.participant_id as string,
      displayName: displayName ?? "Player",
      isLead: row.role_in_session === "lead",
      connected: Boolean(row.connected),
    };
  });
}

export function displayNameMap(roster: RosterMember[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of roster) map[row.participantId] = row.displayName;
  return map;
}

export function connectedIds(roster: RosterMember[]): string[] {
  return roster.filter((row) => row.connected).map((row) => row.participantId);
}

export async function resolvePackId(
  admin: SupabaseClient,
  sessionId: string
): Promise<string> {
  const result = await resolveSessionContentPackId(admin, sessionId);
  if (!result.ok) throw new Error(result.error);
  return result.contentPackId;
}

export async function loadRankAndFileSession(
  admin: SupabaseClient,
  sessionId: string
): Promise<RankAndFileSessionRow | null> {
  const { data, error } = await admin
    .from("rank_and_file_sessions")
    .select("session_id, phase, round_index, current_round_id, hits, committed_rounds")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    session_id: data.session_id as string,
    phase: data.phase as RankAndFilePhase,
    round_index: data.round_index as number,
    current_round_id: (data.current_round_id as string | null) ?? null,
    hits: data.hits as number,
    committed_rounds: data.committed_rounds as number,
  };
}

function parseRail(raw: unknown): (string | null)[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => (typeof item === "string" ? item : null));
}

function mapRound(data: Record<string, unknown>): RankAndFileRoundRow {
  return {
    id: data.id as string,
    session_id: data.session_id as string,
    round_index: data.round_index as number,
    subject_id: data.subject_id as string,
    k: data.k as number,
    write_started_at: (data.write_started_at as string | null) ?? null,
    rank_started_at: (data.rank_started_at as string | null) ?? null,
    committed_at: (data.committed_at as string | null) ?? null,
    rail_order_json: parseRail(data.rail_order_json),
    is_hit: (data.is_hit as boolean | null) ?? null,
    ended_at: (data.ended_at as string | null) ?? null,
    end_reason: (data.end_reason as RankAndFileEndReason | null) ?? null,
  };
}

const ROUND_COLS =
  "id, session_id, round_index, subject_id, k, write_started_at, rank_started_at, committed_at, rail_order_json, is_hit, ended_at, end_reason";

export async function loadRound(
  admin: SupabaseClient,
  roundId: string
): Promise<RankAndFileRoundRow | null> {
  const { data, error } = await admin
    .from("rank_and_file_rounds")
    .select(ROUND_COLS)
    .eq("id", roundId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapRound(data);
}

export async function loadRounds(
  admin: SupabaseClient,
  sessionId: string
): Promise<RankAndFileRoundRow[]> {
  const { data, error } = await admin
    .from("rank_and_file_rounds")
    .select(ROUND_COLS)
    .eq("session_id", sessionId)
    .order("round_index", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRound);
}

export async function loadDeals(
  admin: SupabaseClient,
  roundId: string
): Promise<RankAndFileDealRow[]> {
  const { data, error } = await admin
    .from("rank_and_file_deals")
    .select("id, round_id, participant_id, dealt_number, clue_text, locked_at")
    .eq("round_id", roundId);
  if (error) throw new Error(error.message);
  return (data ?? []) as RankAndFileDealRow[];
}

export async function loadSubject(
  admin: SupabaseClient,
  subjectId: string
): Promise<RankAndFileSubjectRow | null> {
  const { data, error } = await admin
    .from("rank_and_file_subjects")
    .select("id, content_pack_id, pack_index, theme, low_end, high_end, category, active")
    .eq("id", subjectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as RankAndFileSubjectRow | null) ?? null;
}

export async function loadPackSubjects(
  admin: SupabaseClient,
  packId: string
): Promise<RankAndFileSubjectRow[]> {
  const { data, error } = await admin
    .from("rank_and_file_subjects")
    .select("id, content_pack_id, pack_index, theme, low_end, high_end, category, active")
    .eq("content_pack_id", packId)
    .eq("active", true)
    .order("pack_index", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as RankAndFileSubjectRow[];
}

export async function syncPublicState(
  admin: SupabaseClient,
  sessionId: string,
  phase: RankAndFilePhase,
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
        rankAndFile: { phase, ...extra, t: Date.now() },
      },
      updated_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId);
  if (error) throw new Error(error.message);
}
