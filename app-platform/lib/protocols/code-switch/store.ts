import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveSessionContentPackId } from "@/lib/content-packs/session-pack";
import type { Json } from "@/lib/types/database";
import type { WordBand } from "./engine";
import type { CodeSwitchEndReason, CodeSwitchPhase } from "./types";
import type { RoundType } from "./engine";

export type RosterMember = {
  participantId: string;
  displayName: string;
  isLead: boolean;
  connected: boolean;
};

export type CodeSwitchSessionRow = {
  session_id: string;
  phase: CodeSwitchPhase;
  team_score: number;
  current_round_id: string | null;
};

export type CodeSwitchRoundRow = {
  id: string;
  session_id: string;
  round_index: number;
  guesser_id: string;
  word_id: string;
  round_type: RoundType;
  write_started_at: string | null;
  guess_started_at: string | null;
  filtered_clues_json: string[];
  guess_text: string | null;
  is_hit: boolean | null;
  ended_at: string | null;
  end_reason: CodeSwitchEndReason | null;
};

export type CodeSwitchClueRow = {
  id: string;
  round_id: string;
  participant_id: string;
  raw_text: string;
  normalized: string;
  survived: boolean | null;
  locked_at: string;
};

export type CodeSwitchWordRow = {
  id: string;
  content_pack_id: string;
  word: string;
  band: WordBand;
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

export async function loadCodeSwitchSession(
  admin: SupabaseClient,
  sessionId: string
): Promise<CodeSwitchSessionRow | null> {
  const { data, error } = await admin
    .from("code_switch_sessions")
    .select("session_id, phase, team_score, current_round_id")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    session_id: data.session_id as string,
    phase: data.phase as CodeSwitchPhase,
    team_score: data.team_score as number,
    current_round_id: (data.current_round_id as string | null) ?? null,
  };
}

export async function loadRound(
  admin: SupabaseClient,
  roundId: string
): Promise<CodeSwitchRoundRow | null> {
  const { data, error } = await admin
    .from("code_switch_rounds")
    .select(
      "id, session_id, round_index, guesser_id, word_id, round_type, write_started_at, guess_started_at, filtered_clues_json, guess_text, is_hit, ended_at, end_reason"
    )
    .eq("id", roundId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapRound(data);
}

export async function loadRounds(
  admin: SupabaseClient,
  sessionId: string
): Promise<CodeSwitchRoundRow[]> {
  const { data, error } = await admin
    .from("code_switch_rounds")
    .select(
      "id, session_id, round_index, guesser_id, word_id, round_type, write_started_at, guess_started_at, filtered_clues_json, guess_text, is_hit, ended_at, end_reason"
    )
    .eq("session_id", sessionId)
    .order("round_index", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRound);
}

function mapRound(data: Record<string, unknown>): CodeSwitchRoundRow {
  const raw = data.filtered_clues_json;
  const clues = Array.isArray(raw)
    ? raw.filter((item): item is string => typeof item === "string")
    : [];
  return {
    id: data.id as string,
    session_id: data.session_id as string,
    round_index: data.round_index as number,
    guesser_id: data.guesser_id as string,
    word_id: data.word_id as string,
    round_type: data.round_type as RoundType,
    write_started_at: (data.write_started_at as string | null) ?? null,
    guess_started_at: (data.guess_started_at as string | null) ?? null,
    filtered_clues_json: clues,
    guess_text: (data.guess_text as string | null) ?? null,
    is_hit: (data.is_hit as boolean | null) ?? null,
    ended_at: (data.ended_at as string | null) ?? null,
    end_reason: (data.end_reason as CodeSwitchEndReason | null) ?? null,
  };
}

export async function loadClues(
  admin: SupabaseClient,
  roundId: string
): Promise<CodeSwitchClueRow[]> {
  const { data, error } = await admin
    .from("code_switch_clues")
    .select("id, round_id, participant_id, raw_text, normalized, survived, locked_at")
    .eq("round_id", roundId);
  if (error) throw new Error(error.message);
  return (data ?? []) as CodeSwitchClueRow[];
}

export async function loadAllClues(
  admin: SupabaseClient,
  roundIds: string[]
): Promise<CodeSwitchClueRow[]> {
  if (roundIds.length === 0) return [];
  const { data, error } = await admin
    .from("code_switch_clues")
    .select("id, round_id, participant_id, raw_text, normalized, survived, locked_at")
    .in("round_id", roundIds);
  if (error) throw new Error(error.message);
  return (data ?? []) as CodeSwitchClueRow[];
}

export async function loadWord(
  admin: SupabaseClient,
  wordId: string
): Promise<CodeSwitchWordRow | null> {
  const { data, error } = await admin
    .from("code_switch_words")
    .select("id, content_pack_id, word, band, active")
    .eq("id", wordId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CodeSwitchWordRow | null) ?? null;
}

export async function loadPackWords(
  admin: SupabaseClient,
  packId: string
): Promise<CodeSwitchWordRow[]> {
  const { data, error } = await admin
    .from("code_switch_words")
    .select("id, content_pack_id, word, band, active")
    .eq("content_pack_id", packId)
    .eq("active", true);
  if (error) throw new Error(error.message);
  return (data ?? []) as CodeSwitchWordRow[];
}

export async function syncPublicState(
  admin: SupabaseClient,
  sessionId: string,
  phase: CodeSwitchPhase,
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
        codeSwitch: { phase, ...extra, t: Date.now() },
      },
      updated_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId);
  if (error) throw new Error(error.message);
}
