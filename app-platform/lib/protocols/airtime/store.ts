import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/lib/types/database";
import { isSharedScreenName } from "@/lib/protocols/rank-and-file/engine";
import type {
  AirtimePhase,
  Choice,
  DiveState,
  DiverStatus,
  StoredAirtimeEvent,
} from "./types";

export type RosterMember = {
  participantId: string;
  displayName: string;
  isLead: boolean;
  connected: boolean;
};

export type AirtimeSessionRow = {
  session_id: string;
  phase: AirtimePhase;
  revealed: boolean;
  revealed_after_dive: number | null;
  current_dive: number;
  current_turn: number;
  rules_ends_at: string | null;
  window_opens_at: string | null;
  turn_ends_at: string | null;
  end_after_turn: boolean;
  end_banner_until: string | null;
  show_highlight: boolean;
  show_names: boolean;
  dive_state_json: DiveState | null;
  version: number;
};

export type AirtimeBoatRow = {
  id: string;
  name: string;
  sort_order: number;
  is_rival: boolean;
};

export type AirtimeMemberRow = { boat_id: string; participant_id: string };

export type AirtimeBoatDiveRow = {
  dive_number: number;
  boat_id: string;
  tank_start: number;
  result: number;
};

export type AirtimeDiverDiveRow = {
  dive_number: number;
  participant_id: string;
  boat_id: string;
  deepest: number;
  item_id: string;
  status: Exclude<DiverStatus, "underwater">;
  surfaced_turn: number | null;
  haul: number;
};

const SESSION_COLS =
  "session_id, phase, revealed, revealed_after_dive, current_dive, current_turn, rules_ends_at, window_opens_at, turn_ends_at, end_after_turn, end_banner_until, show_highlight, show_names, dive_state_json, version";

export async function loadRoster(admin: SupabaseClient, sessionId: string): Promise<RosterMember[]> {
  const { data, error } = await admin
    .from("session_participants")
    .select("participant_id, role_in_session, connected, participants ( display_name )")
    .eq("session_id", sessionId);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const person = row.participants as { display_name?: string } | { display_name?: string }[] | null;
    const displayName = Array.isArray(person) ? person[0]?.display_name : person?.display_name;
    return {
      participantId: row.participant_id as string,
      displayName: displayName ?? "Player",
      isLead: row.role_in_session === "lead",
      connected: Boolean(row.connected),
    };
  });
}

/** Phones only: the Shared screen row is never a player. */
export function playersOf(roster: RosterMember[]): RosterMember[] {
  return roster.filter((row) => !isSharedScreenName(row.displayName));
}

export async function loadAirtimeSession(
  admin: SupabaseClient,
  sessionId: string
): Promise<AirtimeSessionRow | null> {
  const { data, error } = await admin
    .from("airtime_sessions")
    .select(SESSION_COLS)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AirtimeSessionRow | null) ?? null;
}

/**
 * Compare-and-set on `version`. Returns false if another request changed the
 * row first; the caller must not apply side effects in that case.
 */
export async function casSession(
  admin: SupabaseClient,
  sessionId: string,
  expectedVersion: number,
  patch: Record<string, unknown>
): Promise<boolean> {
  const { data, error } = await admin
    .from("airtime_sessions")
    .update({ ...patch, version: expectedVersion + 1 })
    .eq("session_id", sessionId)
    .eq("version", expectedVersion)
    .select("session_id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function loadBoats(admin: SupabaseClient, sessionId: string): Promise<AirtimeBoatRow[]> {
  const { data, error } = await admin
    .from("airtime_boats")
    .select("id, name, sort_order, is_rival")
    .eq("session_id", sessionId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AirtimeBoatRow[];
}

export async function loadMembers(admin: SupabaseClient, sessionId: string): Promise<AirtimeMemberRow[]> {
  const { data, error } = await admin
    .from("airtime_boat_members")
    .select("boat_id, participant_id")
    .eq("session_id", sessionId);
  if (error) throw new Error(error.message);
  return (data ?? []) as AirtimeMemberRow[];
}

export async function loadChoices(
  admin: SupabaseClient,
  sessionId: string,
  dive: number,
  turn: number
): Promise<Record<string, Choice>> {
  const { data, error } = await admin
    .from("airtime_choices")
    .select("participant_id, choice")
    .eq("session_id", sessionId)
    .eq("dive_number", dive)
    .eq("turn", turn);
  if (error) throw new Error(error.message);
  const out: Record<string, Choice> = {};
  for (const row of data ?? []) out[row.participant_id as string] = row.choice as Choice;
  return out;
}

export async function loadBoatDives(admin: SupabaseClient, sessionId: string): Promise<AirtimeBoatDiveRow[]> {
  const { data, error } = await admin
    .from("airtime_boat_dives")
    .select("dive_number, boat_id, tank_start, result")
    .eq("session_id", sessionId)
    .order("dive_number", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AirtimeBoatDiveRow[];
}

export async function loadDiverDives(
  admin: SupabaseClient,
  sessionId: string
): Promise<AirtimeDiverDiveRow[]> {
  const { data, error } = await admin
    .from("airtime_diver_dives")
    .select("dive_number, participant_id, boat_id, deepest, item_id, status, surfaced_turn, haul")
    .eq("session_id", sessionId)
    .order("dive_number", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AirtimeDiverDiveRow[];
}

export async function loadEvents(admin: SupabaseClient, sessionId: string): Promise<StoredAirtimeEvent[]> {
  const { data, error } = await admin
    .from("airtime_events")
    .select("dive_number, turn, type, payload_json")
    .eq("session_id", sessionId)
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(
    (row) =>
      ({
        dive: row.dive_number as number,
        turn: row.turn as number,
        type: row.type,
        payload: row.payload_json,
      }) as StoredAirtimeEvent
  );
}

export async function insertEvents(
  admin: SupabaseClient,
  sessionId: string,
  events: StoredAirtimeEvent[]
): Promise<void> {
  if (events.length === 0) return;
  const { error } = await admin.from("airtime_events").insert(
    events.map((e) => ({
      session_id: sessionId,
      dive_number: e.dive,
      turn: e.turn,
      type: e.type,
      payload_json: e.payload as unknown as Json,
    }))
  );
  if (error) throw new Error(error.message);
}

/**
 * Realtime poke. Public fields only — never tanks, depths, items, or totals.
 */
export async function syncPublicState(
  admin: SupabaseClient,
  sessionId: string,
  phase: AirtimePhase,
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
        airtime: { phase, ...extra, t: Date.now() },
      },
      updated_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId);
  if (error) throw new Error(error.message);
}
