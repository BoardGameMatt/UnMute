import type { Json } from "@/lib/types/database";

export const TRUTH_IS_PROTOCOL_VERSION = 1 as const;

/** Phases for "The Truth Is..." — mirrors session_state.phase when this protocol is active. */
export type TruthIsPhase =
  | "SUBMISSION_1"
  | "SUBMISSION_2"
  | "READING_ASSIGNMENT"
  | "BLUFF_RULES"
  | "DISCUSSION"
  | "VOTING"
  | "REVEAL"
  | "LEADERBOARD"
  | "WRAP_UP"
  | "RESULTS";

export interface TruthIsEntry {
  id: string;
  author_id: string;
  text: string;
  round_submitted: 1 | 2;
  used: boolean;
  /** voter participant id → guessed author participant id */
  guesses: Record<string, string>;
  correct_count: number;
}

export interface TruthIsParticipant {
  id: string;
  display_name: string;
}

/**
 * Protocol-specific state_json for the-truth-is.
 * Timers: server stores timer_started_at + timer_duration_seconds; clients render arcs and fire actions.
 */
export interface TruthIsState {
  version: typeof TRUTH_IS_PROTOCOL_VERSION;
  phase: TruthIsPhase;
  participants: TruthIsParticipant[];
  entries: TruthIsEntry[];
  scores: Record<string, number>;
  /** Shuffled queue of entry ids to read (built after SUBMISSION_2). */
  play_order: string[];
  /** Cursor into play_order for the next assignment. */
  play_order_index: number;
  /** Reading round index (increments each full read→reveal cycle). */
  current_round: number;
  /** Completed reveal cycles (used for leaderboard triggers). */
  total_rounds_played: number;
  /** Minimum reading rounds (= player count at init). */
  minimum_rounds: number;
  /** Denominator for session progress bar (extends on "A Few More"). */
  progress_total_rounds: number;
  current_entry_id: string | null;
  current_reader_id: string | null;
  current_author_id: string | null;
  /** Author of the entry read in the previous cycle — next reader after round 1. */
  next_reader_from_previous_author_id: string | null;
  timer_started_at: string | null;
  timer_duration_seconds: number;
  votes_this_round: Record<string, string>;
  lead_chose_continue: boolean;
  /** Extra entries queued when lead picks "A Few More". */
  few_more_extra_entries: number;
  last_leaderboard_at_round: number;
  most_surprising_entry_id: string | null;
  /** When true, protocol has finished. */
  session_complete: boolean;
  /** Tracks skips when a player submits nothing for a prompt (timer or explicit). */
  skipped_rounds: Record<string, { r1?: boolean; r2?: boolean }>;
  /** Populated after processReveal (omitted in v1 persisted state). */
  last_round_author_bluffed?: boolean;
  last_round_author_points_earned?: number;
}

/** Server-computed scoring for one reveal (VOTING/REVEAL). */
export interface TruthIsRoundScores {
  /** Points to add per participant this round. */
  scoreDeltas: Record<string, number>;
  /** True if no vote targeted the author (nobody “caught” them). */
  authorBluffed: boolean;
  /** Author’s total from bluff rules this round (0 if not a bluff round). */
  authorPointsEarned: number;
  /** Non-author voters who guessed someone other than the author (bluff round). */
  fooledVoterIds: string[];
  /** Non-author voters who guessed the author (bluff round). */
  caughtVoterIds: string[];
}

export function isTruthIsState(json: unknown): json is TruthIsState {
  if (json === null || typeof json !== "object" || Array.isArray(json)) return false;
  const o = json as Record<string, unknown>;
  return (
    o.version === TRUTH_IS_PROTOCOL_VERSION &&
    typeof o.phase === "string" &&
    Array.isArray(o.participants) &&
    Array.isArray(o.entries)
  );
}

/** Serialize for Supabase Json column (no undefined). */
export function truthIsStateToJson(state: TruthIsState): Json {
  return JSON.parse(JSON.stringify(state)) as Json;
}
