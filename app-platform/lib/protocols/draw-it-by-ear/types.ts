import type { Json } from "@/lib/types/database";

export const DIBE_PROTOCOL_VERSION = 1 as const;

export type DibeSessionLength = "FULL" | "SHORT";

export type DibePhase =
  | "MATERIALS_CHECK"
  | "TUTORIAL_DESCRIBE"
  | "TUTORIAL_IMAGE_REVEAL"
  | "TUTORIAL_SCORING_1PT"
  | "TUTORIAL_RESULTS"
  | "TEAM_FORMATION"
  | "BREAKOUT_SETUP"
  | "ROUND_DESCRIBE"
  | "ROUND_IMAGE_REVEAL"
  | "RETURN_TO_MAIN"
  | "SHOW_DRAWINGS"
  | "ROUND_SCORING_1PT"
  | "ROUND_SCORING_2PT"
  | "ROUND_SCORING_3PT"
  | "ROUND_AGGREGATE"
  | "LEADERBOARD"
  | "FINAL_RESULTS";

export interface DibeCriterion {
  text: string;
  points: 1 | 2 | 3;
}

export interface DibeImageCatalogEntry {
  id: string;
  name: string;
  criteria: DibeCriterion[];
}

export interface DibeParticipant {
  id: string;
  display_name: string;
}

export interface DibeTeam {
  id: string;
  name: string;
  color: string;
  member_ids: string[];
  describer_rotation: string[];
  current_describer_index: number;
  cumulative_score: number;
}

export type DibeTeamFormationMode = "auto" | "self_select" | null;

/** Per-breakout-room start gating for a non-tutorial drawing round. */
export interface DibeTeamRoundStart {
  /** Set when that room's describer presses Go. */
  countdown_started_at: string;
  /** When the countdown ends and that room's drawing timer begins. */
  drawing_started_at: string;
  /**
   * Set when that room's drawing timer runs out. Round end is per-room: the
   * session only leaves ROUND_DESCRIBE once every room that started is marked.
   * Optional because state persisted before per-room completion existed.
   */
  drawing_completed_at?: string | null;
}

/** Scoring phase to enter once SHOW_DRAWINGS exits. */
export type DibePostDrawingsPhase = "TUTORIAL_SCORING_1PT" | "ROUND_SCORING_1PT";

export interface DibeRoundState {
  round_number: number;
  image_id: string;
  image_name: string;
  /** Criterion text → count of participants who answered yes (aggregate). */
  criterion_hits: Record<string, number>;
  /** participant id → points earned this round */
  participant_round_scores: Record<string, number>;
  team_round_scores: Record<string, number>;
}

export interface DibeState {
  version: typeof DIBE_PROTOCOL_VERSION;
  phase: DibePhase;
  participants: DibeParticipant[];
  session_length: DibeSessionLength | null;
  /** Scored rounds completed (0 before first scored round ends). */
  total_rounds_played: number;
  /** Current scored round (1-based during rounds). */
  current_round: number;
  /** Denominator for progress bar. */
  progress_total_rounds: number;
  teams: DibeTeam[];
  team_formation_mode: DibeTeamFormationMode;
  teams_locked: boolean;
  /** Participant id of the session lead (drives lead-name copy). */
  lead_participant_id: string | null;
  /** team id → that room's Go/countdown timestamps for the current round. */
  team_round_starts: Record<string, DibeTeamRoundStart>;
  /** Scoring phase queued while RETURN_TO_MAIN / SHOW_DRAWINGS run. */
  post_show_drawings_phase: DibePostDrawingsPhase | null;
  /** Image catalog (no URLs — paths resolved server-side). */
  image_catalog: DibeImageCatalogEntry[];
  tutorial_describer_id: string | null;
  /** Active image id for tutorial or current round (never expose URL in state). */
  active_image_id: string | null;
  active_image_name: string | null;
  /** Criteria for active scoring phase (text + points only). */
  active_criteria: DibeCriterion[];
  images_used: string[];
  rounds: DibeRoundState[];
  /** participant id → { criterionText → true/false } for current scoring sub-phase */
  scoring_submissions: Record<string, Record<string, boolean>>;
  /** Merged hits for current round scoring tiers */
  round_criterion_hits: Record<string, number>;
  /** Cumulative individual scores across scored rounds */
  participant_cumulative_scores: Record<string, number>;
  /** Per-describer best single-round team score (for MVP award) */
  describer_best_round_scores: Record<string, number>;
  timer_started_at: string | null;
  /**
   * timer_started_at value already consumed by an expiry post.
   *
   * NOTE: this field is shared across every timer in the protocol (describe,
   * show-drawings, each scoring tier). It collapses duplicate posts within a
   * single timer window, but it does NOT identify which timer expired — a
   * stale post from an earlier phase sees a fresh timer_started_at and passes
   * this guard. Expiry actions must also carry the phase they were armed under.
   */
  last_expired_timer_at: string | null;
  timer_duration_seconds: number;
  session_complete: boolean;
  formation_error: string | null;
}

export function isDrawItByEarState(json: unknown): json is DibeState {
  if (json === null || typeof json !== "object" || Array.isArray(json)) return false;
  const o = json as Record<string, unknown>;
  return (
    o.version === DIBE_PROTOCOL_VERSION &&
    typeof o.phase === "string" &&
    Array.isArray(o.participants)
  );
}

export function drawItByEarStateToJson(state: DibeState): Json {
  return JSON.parse(JSON.stringify(state)) as Json;
}
