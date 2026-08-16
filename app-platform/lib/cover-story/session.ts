import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CoverStoryDeal,
  CoverStoryPhase,
  CoverStorySession,
  Json,
} from "@/lib/types/database";
import type { CoverStoryPublicState } from "./types";
import { formatRevealDate } from "./format";

export type MemberRow = {
  participantId: string;
  displayName: string;
  isLead: boolean;
};

export async function loadMembers(
  admin: SupabaseClient,
  sessionId: string
): Promise<MemberRow[]> {
  const { data, error } = await admin
    .from("session_participants")
    .select("participant_id, role_in_session, participants ( display_name )")
    .eq("session_id", sessionId);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const nested = row.participants as { display_name?: string } | { display_name?: string }[] | null;
    const person = Array.isArray(nested) ? nested[0] : nested;
    return {
      participantId: row.participant_id as string,
      displayName: person?.display_name ?? "Player",
      isLead: row.role_in_session === "lead",
    };
  });
}

export function playersOnly(members: MemberRow[]): MemberRow[] {
  return members.filter((m) => !m.isLead);
}

export async function loadCoverStorySession(
  admin: SupabaseClient,
  sessionId: string
): Promise<CoverStorySession | null> {
  const { data, error } = await admin
    .from("cover_story_sessions")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CoverStorySession | null) ?? null;
}

export async function ensureCoverStorySession(
  admin: SupabaseClient,
  sessionId: string
): Promise<CoverStorySession> {
  const existing = await loadCoverStorySession(admin, sessionId);
  if (existing) return existing;

  const { data, error } = await admin
    .from("cover_story_sessions")
    .insert({ session_id: sessionId, phase: "lobby" })
    .select("*")
    .single();

  if (error) {
    const raced = await loadCoverStorySession(admin, sessionId);
    if (raced) return raced;
    throw new Error(error.message);
  }
  return data as CoverStorySession;
}

/** Wipe deals / guesses / scores and park Cover Story back in lobby. */
export async function resetCoverStorySessionToLobby(
  admin: SupabaseClient,
  sessionId: string
): Promise<void> {
  const cs = await loadCoverStorySession(admin, sessionId);
  if (!cs) return;

  const { error: guessErr } = await admin
    .from("cover_story_guesses")
    .delete()
    .eq("cover_story_session_id", cs.id);
  if (guessErr) throw new Error(guessErr.message);

  const { error: resultErr } = await admin
    .from("cover_story_target_results")
    .delete()
    .eq("cover_story_session_id", cs.id);
  if (resultErr) throw new Error(resultErr.message);

  const { error: dealErr } = await admin
    .from("cover_story_deals")
    .delete()
    .eq("cover_story_session_id", cs.id);
  if (dealErr) throw new Error(dealErr.message);

  const { error } = await admin
    .from("cover_story_sessions")
    .update({
      phase: "lobby",
      reveal_on: null,
      reveal_index: 0,
      reveal_order: [],
      reveal_subphase: "guess",
      guess_started_at: null,
    })
    .eq("id", cs.id);
  if (error) throw new Error(error.message);

  await syncPublicState(admin, sessionId, {
    phase: "lobby",
    playbackIndex: 0,
    insightsOn: false,
    readers: {},
  });
}

export async function syncPublicState(
  admin: SupabaseClient,
  sessionId: string,
  patch: Partial<CoverStoryPublicState> & { phase?: CoverStoryPhase }
): Promise<void> {
  const { data: row, error: readErr } = await admin
    .from("session_state")
    .select("state_json, phase")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);

  const current = (row?.state_json ?? {}) as Record<string, Json | undefined>;
  const prev = (current.coverStory ?? {}) as Partial<CoverStoryPublicState>;
  const next: CoverStoryPublicState = {
    phase: patch.phase ?? prev.phase ?? "lobby",
    playbackIndex: patch.playbackIndex ?? prev.playbackIndex ?? 0,
    insightsOn: patch.insightsOn ?? prev.insightsOn ?? false,
    readers: patch.readers ?? prev.readers ?? {},
  };

  const { error } = await admin
    .from("session_state")
    .update({
      phase: next.phase,
      state_json: { ...current, coverStory: next },
      updated_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId);
  if (error) throw new Error(error.message);
}

export async function loadDeals(
  admin: SupabaseClient,
  coverStorySessionId: string
): Promise<CoverStoryDeal[]> {
  const { data, error } = await admin
    .from("cover_story_deals")
    .select("*")
    .eq("cover_story_session_id", coverStorySessionId);
  if (error) throw new Error(error.message);
  return (data ?? []) as CoverStoryDeal[];
}

export function burnedAgencyIds(deals: CoverStoryDeal[]): Set<number> {
  const burned = new Set<number>();
  for (const deal of deals) {
    for (const id of deal.shown_agency_ids) burned.add(id);
  }
  return burned;
}

export { formatRevealDate } from "./format";

export function missionCopyPaste(input: {
  agencyName: string;
  revealOn: string | null;
  words: string[];
}): string {
  const lines = [
    "COVER STORY",
    `Agency: ${input.agencyName}`,
    `Reveal: ${formatRevealDate(input.revealOn)}`,
    "Words:",
    ...input.words.map((word, i) => `${i + 1}. ${word}`),
    "Rules: Speak each word in a meeting with at least two other people from this session. Do not name your agency. Spoken words only. Keep a private note of the date, who was there, and a little context. File that proof at the reveal — there is no in-app log during the field.",
  ];
  return lines.join("\n");
}
