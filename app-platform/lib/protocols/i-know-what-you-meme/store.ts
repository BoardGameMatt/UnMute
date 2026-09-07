import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveSessionContentPackId } from "@/lib/content-packs/session-pack";
import type { Json } from "@/lib/types/database";
import type { IkwymPhase } from "./types";

export type RosterMember = {
  participantId: string;
  displayName: string;
  role: "lead" | "member";
  connected: boolean;
};

export type IkwymPromptRow = {
  id: string;
  content_pack_id: string;
  kind: "checkin" | "stimulus";
  label: string;
  prompt: string;
  active: boolean;
  sort_order: number;
};

export type IkwymSessionRow = {
  session_id: string;
  phase: IkwymPhase;
  round_index: number;
  r1_checkin_id: string;
  r1_stimulus_id: string;
  r2_checkin_id: string;
  r2_stimulus_id: string;
  current_reveal_item_id: string | null;
  guess_started_at: string | null;
};

export type IkwymResponseRow = {
  id: string;
  session_id: string;
  participant_id: string;
  round: number;
  gif_url: string;
  open_response: string;
  stimulus_response: string;
  search_query: string;
};

export type IkwymRevealItemRow = {
  id: string;
  session_id: string;
  sort_index: number;
  round: number;
  owner_id: string;
  gif_url: string;
  resolved_at: string | null;
};

export type IkwymGuessRow = {
  id: string;
  reveal_item_id: string;
  participant_id: string;
  guessed_participant_id: string;
  locked_at: string;
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
  return Object.fromEntries(roster.map((row) => [row.participantId, row.displayName]));
}

export function connectedIds(roster: RosterMember[]): string[] {
  return roster.filter((row) => row.connected).map((row) => row.participantId);
}

export async function resolvePackId(admin: SupabaseClient, sessionId: string): Promise<string> {
  const result = await resolveSessionContentPackId(admin, sessionId);
  if (!result.ok) throw new Error(result.error);
  return result.contentPackId;
}

export async function loadPrompts(
  admin: SupabaseClient,
  packId: string
): Promise<IkwymPromptRow[]> {
  const { data, error } = await admin
    .from("ikwym_prompts")
    .select("id, content_pack_id, kind, label, prompt, active, sort_order")
    .eq("content_pack_id", packId)
    .eq("active", true);
  if (error) throw new Error(error.message);
  return (data ?? []) as IkwymPromptRow[];
}

export async function loadPrompt(
  admin: SupabaseClient,
  id: string
): Promise<IkwymPromptRow | null> {
  const { data, error } = await admin
    .from("ikwym_prompts")
    .select("id, content_pack_id, kind, label, prompt, active, sort_order")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as IkwymPromptRow | null) ?? null;
}

export async function loadIkwymSession(
  admin: SupabaseClient,
  sessionId: string
): Promise<IkwymSessionRow | null> {
  const { data, error } = await admin
    .from("ikwym_sessions")
    .select(
      "session_id, phase, round_index, r1_checkin_id, r1_stimulus_id, r2_checkin_id, r2_stimulus_id, current_reveal_item_id, guess_started_at"
    )
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as IkwymSessionRow | null) ?? null;
}

export async function loadResponses(
  admin: SupabaseClient,
  sessionId: string,
  round?: 1 | 2
): Promise<IkwymResponseRow[]> {
  let query = admin
    .from("ikwym_responses")
    .select("id, session_id, participant_id, round, gif_url, open_response, stimulus_response, search_query")
    .eq("session_id", sessionId);
  if (round) query = query.eq("round", round);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as IkwymResponseRow[];
}

export async function loadRevealItems(
  admin: SupabaseClient,
  sessionId: string
): Promise<IkwymRevealItemRow[]> {
  const { data, error } = await admin
    .from("ikwym_reveal_items")
    .select("id, session_id, sort_index, round, owner_id, gif_url, resolved_at")
    .eq("session_id", sessionId)
    .order("sort_index", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as IkwymRevealItemRow[];
}

export async function loadGuesses(
  admin: SupabaseClient,
  revealItemId: string
): Promise<IkwymGuessRow[]> {
  const { data, error } = await admin
    .from("ikwym_guesses")
    .select("id, reveal_item_id, participant_id, guessed_participant_id, locked_at")
    .eq("reveal_item_id", revealItemId);
  if (error) throw new Error(error.message);
  return (data ?? []) as IkwymGuessRow[];
}

export async function loadAllGuesses(
  admin: SupabaseClient,
  revealItemIds: string[]
): Promise<IkwymGuessRow[]> {
  if (revealItemIds.length === 0) return [];
  const { data, error } = await admin
    .from("ikwym_guesses")
    .select("id, reveal_item_id, participant_id, guessed_participant_id, locked_at")
    .in("reveal_item_id", revealItemIds);
  if (error) throw new Error(error.message);
  return (data ?? []) as IkwymGuessRow[];
}

export async function syncPublicState(
  admin: SupabaseClient,
  sessionId: string,
  phase: IkwymPhase,
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
        ikwym: { phase, ...extra, t: Date.now() },
      },
    })
    .eq("session_id", sessionId);
  if (error) throw new Error(error.message);
}
