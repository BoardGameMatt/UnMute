import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/lib/types/database";
import { toPublicPulse } from "./project";
import {
  isTruthIsState,
  truthIsStateToJson,
  type TruthIsEntry,
  type TruthIsState,
} from "./types";

export type RosterMember = {
  participantId: string;
  displayName: string;
  role: "lead" | "member";
};

function asGuesses(value: Json): Record<string, string> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, guessed] of Object.entries(value)) {
    if (typeof guessed === "string") out[key] = guessed;
  }
  return out;
}

export async function loadRoster(
  admin: SupabaseClient,
  sessionId: string
): Promise<RosterMember[]> {
  const { data, error } = await admin
    .from("session_participants")
    .select("participant_id, role_in_session, participants ( display_name )")
    .eq("session_id", sessionId);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const person = row.participants as
      | { display_name?: string }
      | { display_name?: string }[]
      | null;
    const name = Array.isArray(person) ? person[0]?.display_name : person?.display_name;
    return {
      participantId: row.participant_id,
      displayName: name?.trim() || "Player",
      role: row.role_in_session,
    };
  });
}

export async function loadSessionStatus(
  admin: SupabaseClient,
  sessionId: string
): Promise<string | null> {
  const { data, error } = await admin
    .from("sessions")
    .select("status")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.status ?? null;
}

export async function loadTruthIsState(
  admin: SupabaseClient,
  sessionId: string
): Promise<TruthIsState | null> {
  const { data: session, error } = await admin
    .from("truth_is_sessions")
    .select("state_json")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!session) return null;

  const { data: rows, error: entryErr } = await admin
    .from("truth_is_entries")
    .select("id, author_id, text, round_submitted, used, guesses, correct_count")
    .eq("session_id", sessionId);
  if (entryErr) throw new Error(entryErr.message);

  const entries: TruthIsEntry[] = (rows ?? []).flatMap((row) => {
    if (row.round_submitted !== 1 && row.round_submitted !== 2) return [];
    return [
      {
        id: row.id,
        author_id: row.author_id,
        text: row.text,
        round_submitted: row.round_submitted,
        used: row.used,
        guesses: asGuesses(row.guesses),
        correct_count: row.correct_count,
      },
    ];
  });

  const candidate = {
    ...(session.state_json as object),
    entries,
  };
  if (!isTruthIsState(candidate)) {
    throw new Error("The Truth Is session is unreadable.");
  }
  return candidate;
}

export async function saveTruthIsState(
  admin: SupabaseClient,
  sessionId: string,
  state: TruthIsState
): Promise<void> {
  const stored = truthIsStateToJson({ ...state, entries: [] });
  const { error: sessionErr } = await admin.from("truth_is_sessions").upsert({
    session_id: sessionId,
    phase: state.phase,
    state_json: stored,
  });
  if (sessionErr) throw new Error(sessionErr.message);

  const { error: deleteErr } = await admin
    .from("truth_is_entries")
    .delete()
    .eq("session_id", sessionId);
  if (deleteErr) throw new Error(deleteErr.message);

  if (state.entries.length > 0) {
    const { error: insertErr } = await admin.from("truth_is_entries").insert(
      state.entries.map((entry) => ({
        id: entry.id,
        session_id: sessionId,
        author_id: entry.author_id,
        text: entry.text,
        round_submitted: entry.round_submitted,
        used: entry.used,
        guesses: entry.guesses,
        correct_count: entry.correct_count,
      }))
    );
    if (insertErr) throw new Error(insertErr.message);
  }

  await syncPublicPulse(admin, sessionId, state);
}

export async function syncPublicPulse(
  admin: SupabaseClient,
  sessionId: string,
  state: TruthIsState
): Promise<void> {
  const pulse = toPublicPulse(state);
  const { error } = await admin
    .from("session_state")
    .update({
      phase: state.phase,
      current_round: state.total_rounds_played,
      state_json: { truthIs: pulse },
      updated_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId);
  if (error) throw new Error(error.message);
}

export async function markSessionCompleted(
  admin: SupabaseClient,
  sessionId: string
): Promise<void> {
  const { error } = await admin
    .from("sessions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", sessionId);
  if (error) throw new Error(error.message);
}
