/**
 * Row shapes and Supabase Database typing — keep in sync with
 * supabase/migrations/001_initial_schema.sql
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type PersonAuthProvider = "google" | "microsoft" | null;

export interface Person {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  auth_provider: PersonAuthProvider;
  supabase_auth_id: string | null;
  created_at: string;
}

export type ProtocolType = "realtime" | "turnbased" | "async";

export interface Protocol {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: ProtocolType;
  min_players: number;
  max_players: number;
  config_schema: Json;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  join_code: string;
  require_auth: boolean;
  created_by: string | null;
  created_at: string;
}

export type TeamRosterRole = "lead" | "member";

export interface TeamRoster {
  id: string;
  team_id: string;
  email: string;
  display_name_hint: string | null;
  role: TeamRosterRole;
  invited_at: string;
  claimed_by: string | null;
}

export type ParticipantRole = "lead" | "member";

export interface Participant {
  id: string;
  team_id: string;
  person_id: string | null;
  display_name: string;
  role: ParticipantRole;
  avatar_seed: string | null;
  joined_at: string;
}

export type SeasonStatus = "draft" | "active" | "completed";

export interface Season {
  id: string;
  team_id: string;
  name: string;
  start_date: string | null;
  status: SeasonStatus;
  created_at: string;
}

export interface ProtocolSlot {
  id: string;
  season_id: string;
  protocol_id: string;
  week_number: number;
  sort_order: number;
}

export type SessionStatus = "lobby" | "active" | "completed" | "cancelled";

export interface Session {
  id: string;
  protocol_id: string;
  protocol_slot_id: string | null;
  team_id: string;
  status: SessionStatus;
  join_code: string;
  /**
   * @deprecated Stopped reading — host_token is the lead claim path.
   * Column kept in production; do not drop.
   */
  designated_lead_name: string | null;
  /** Unguessable token for the facilitator host URL. */
  host_token: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export type SessionParticipantRole = "lead" | "member";

export interface SessionParticipant {
  id: string;
  session_id: string;
  participant_id: string;
  role_in_session: SessionParticipantRole;
  connected: boolean;
  joined_at: string;
  department: string | null;
}

export interface SessionState {
  id: string;
  session_id: string;
  current_round: number;
  phase: string;
  state_json: Json;
  updated_at: string;
}

export interface SessionFeedback {
  id: string;
  session_id: string;
  participant_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

/** Insert / Update payloads aligned with Postgres defaults & nullability */

export type PersonInsert = {
  id?: string;
  email: string;
  display_name?: string | null;
  avatar_url?: string | null;
  auth_provider?: PersonAuthProvider;
  supabase_auth_id?: string | null;
  created_at?: string;
};

export type PersonUpdate = Partial<Omit<Person, "id">>;

export type ProtocolInsert = {
  id?: string;
  slug: string;
  name: string;
  description?: string | null;
  type: ProtocolType;
  min_players?: number;
  max_players?: number;
  config_schema?: Json;
  created_at?: string;
};

export type ProtocolUpdate = Partial<Omit<Protocol, "id">>;

export type TeamInsert = {
  id?: string;
  name: string;
  join_code?: string;
  require_auth?: boolean;
  created_by?: string | null;
  created_at?: string;
};

export type TeamUpdate = Partial<Omit<Team, "id">>;

export type TeamRosterInsert = {
  id?: string;
  team_id: string;
  email: string;
  display_name_hint?: string | null;
  role?: TeamRosterRole;
  invited_at?: string;
  claimed_by?: string | null;
};

export type TeamRosterUpdate = Partial<Omit<TeamRoster, "id">>;

export type ParticipantInsert = {
  id?: string;
  team_id: string;
  person_id?: string | null;
  display_name: string;
  role: ParticipantRole;
  avatar_seed?: string | null;
  joined_at?: string;
};

export type ParticipantUpdate = Partial<Omit<Participant, "id">>;

export type SeasonInsert = {
  id?: string;
  team_id: string;
  name: string;
  start_date?: string | null;
  status?: SeasonStatus;
  created_at?: string;
};

export type SeasonUpdate = Partial<Omit<Season, "id">>;

export type ProtocolSlotInsert = {
  id?: string;
  season_id: string;
  protocol_id: string;
  week_number: number;
  sort_order?: number;
};

export type ProtocolSlotUpdate = Partial<Omit<ProtocolSlot, "id">>;

export type SessionInsert = {
  id?: string;
  protocol_id: string;
  protocol_slot_id?: string | null;
  team_id: string;
  status?: SessionStatus;
  join_code?: string;
  designated_lead_name?: string | null;
  host_token?: string;
  started_at?: string | null;
  completed_at?: string | null;
  created_at?: string;
};

export type SessionUpdate = Partial<Omit<Session, "id">>;

export type SessionParticipantInsert = {
  id?: string;
  session_id: string;
  participant_id: string;
  role_in_session: SessionParticipantRole;
  connected?: boolean;
  joined_at?: string;
  department?: string | null;
};

export type SessionParticipantUpdate = Partial<Omit<SessionParticipant, "id">>;

export type SessionStateInsert = {
  id?: string;
  session_id: string;
  current_round?: number;
  phase?: string;
  state_json?: Json;
  updated_at?: string;
};

export type SessionStateUpdate = Partial<Omit<SessionState, "id">>;

export interface ProtocolImage {
  id: string;
  protocol_slug: string;
  name: string;
  image_path: string;
  criteria: Json;
  created_at: string;
}

export type ProtocolImageInsert = Omit<ProtocolImage, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export interface DibeTeamRow {
  id: string;
  session_id: string;
  name: string;
  color: string;
  member_ids: string[];
  describer_rotation: string[];
  current_describer_index: number;
  cumulative_score: number;
  created_at: string;
}

export type DibeTeamRowInsert = Omit<DibeTeamRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

// ---------------------------------------------------------------------------
// Wrong Answers Only (migrations 008 + 009)
// ---------------------------------------------------------------------------

export type WaoRegionTag = "us" | "intl" | "global";
export type WaoTrapTier = "gimme" | "graded" | "trap";
export type WaoLockReason = "both_locked" | "timer";
export type WaoTapAction = "select" | "deselect";

export interface WaoQuestion {
  id: string;
  category_title: string;
  disambiguation_rule: string;
  disambiguation_detail: string | null;
  correct_count: number;
  difficulty: number;
  region_tag: WaoRegionTag;
  pinned: boolean;
  active: boolean;
  created_at: string;
}

export type WaoQuestionInsert = Omit<WaoQuestion, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
  pinned?: boolean;
  active?: boolean;
};

export interface WaoQuestionItem {
  id: string;
  question_id: string;
  label: string;
  is_correct: boolean;
  trap_tier: WaoTrapTier;
  source_1_url: string | null;
  source_1_note: string | null;
  source_2_url: string | null;
  source_2_note: string | null;
  created_at: string;
}

export type WaoQuestionItemInsert = Omit<WaoQuestionItem, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export interface WaoSession {
  id: string;
  session_id: string;
  timer_seconds: number;
  round_count: number;
  follow_window_seconds: number;
  concurrence_rate: number | null;
  paired_round_count: number | null;
  exact_match_round_count: number | null;
  created_at: string;
}

export type WaoSessionInsert = Omit<WaoSession, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
  timer_seconds?: number;
  round_count?: number;
  follow_window_seconds?: number;
};

export interface WaoRound {
  id: string;
  wao_session_id: string;
  round_number: number;
  question_id: string;
  is_sample: boolean;
  started_at: string | null;
  locked_at: string | null;
  lock_reason: WaoLockReason | null;
  created_at: string;
}

export type WaoRoundInsert = Omit<WaoRound, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
  is_sample?: boolean;
};

export interface WaoPair {
  id: string;
  round_id: string;
  participant_a: string;
  participant_b: string | null;
  is_solo: boolean;
  relaxation_note: string | null;
  locked_a_at: string | null;
  locked_b_at: string | null;
  created_at: string;
}

export type WaoPairInsert = Omit<WaoPair, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
  is_solo?: boolean;
};

export interface WaoTap {
  id: string;
  pair_id: string;
  participant_id: string;
  item_id: string;
  action: WaoTapAction;
  client_seq: number;
  created_at: string;
}

export type WaoTapInsert = Omit<WaoTap, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export interface WaoRoundResult {
  id: string;
  pair_id: string;
  submitted_item_ids: string[];
  score: number;
  bonus: number;
  lott: number;
  had_save: boolean;
  /** Participant who declined a correct item; null when no Save. */
  saver_participant_id: string | null;
  exact_match: boolean;
  created_at: string;
}

export type WaoRoundResultInsert = Omit<WaoRoundResult, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

/** Trane Quiz — isolated side product (migration 013). */

export type TraneOfferingPhase =
  | "waiting"
  | "pre_open"
  | "pre_closed"
  | "post_open"
  | "closed";

export type TraneResponsePhase = "pre" | "post";

export type TraneQuestionOption = {
  key: string;
  label: string;
};

export interface TraneCourse {
  id: string;
  slug: string;
  title: string;
  revision_label: string;
  created_at: string;
}

export type TraneCourseInsert = Omit<TraneCourse, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export interface TraneQuestion {
  id: string;
  course_id: string;
  sort_order: number;
  stem: string;
  options: TraneQuestionOption[];
  correct_option: string;
  created_at: string;
}

export type TraneQuestionInsert = Omit<TraneQuestion, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
  options: Json;
};

export interface TraneOffering {
  id: string;
  course_id: string;
  class_date: string;
  label: string | null;
  phase: TraneOfferingPhase;
  join_code: string;
  host_token: string;
  created_at: string;
  closed_at: string | null;
}

export type TraneOfferingInsert = Omit<
  TraneOffering,
  "id" | "created_at" | "join_code" | "host_token" | "phase" | "closed_at"
> & {
  id?: string;
  created_at?: string;
  join_code?: string;
  host_token?: string;
  phase?: TraneOfferingPhase;
  closed_at?: string | null;
  label?: string | null;
};

export interface TraneParticipant {
  id: string;
  offering_id: string;
  token: string;
  pre_completed_at: string | null;
  post_completed_at: string | null;
  post_unpaired: boolean;
  post_unpaired_confirmed_at: string | null;
  created_at: string;
}

export type TraneParticipantInsert = Omit<TraneParticipant, "id" | "created_at" | "token"> & {
  id?: string;
  created_at?: string;
  token?: string;
  pre_completed_at?: string | null;
  post_completed_at?: string | null;
  post_unpaired?: boolean;
  post_unpaired_confirmed_at?: string | null;
};

export interface TraneResponse {
  id: string;
  offering_id: string;
  participant_id: string;
  question_id: string;
  phase: TraneResponsePhase;
  selected_option: string;
  submitted_at: string;
}

export type TraneResponseInsert = Omit<TraneResponse, "id" | "submitted_at"> & {
  id?: string;
  submitted_at?: string;
};

// ---------------------------------------------------------------------------
// Cover Story (migrations 014 + 015 + 016)
// ---------------------------------------------------------------------------

export type CoverStoryPhase =
  | "lobby"
  | "reading"
  | "discuss"
  | "insights"
  | "deal"
  | "field"
  | "reveal"
  | "complete";

export type CoverStoryRevealSubphase =
  | "mission"
  | "guess"
  | "gallery"
  | "mark"
  | "board"
  | "points"
  | "final";

export type CoverStoryAgencyKind =
  | "natural_taxonomy"
  | "food_drink"
  | "procedural_terms"
  | "manufactured_object"
  | "proper_noun_set"
  | "abstract_vocabulary"
  | "pop_culture_property";

export type CoverStoryWordLogStatus = "open" | "planted" | "not_planted";

export interface CoverStoryAgency {
  id: number;
  slug: string;
  official_name: string;
  aliases: string[];
  kind: CoverStoryAgencyKind;
  pop_culture: boolean;
  tier: number;
  playable: boolean;
  active: boolean;
  hr_safe: boolean;
  notes: string | null;
  created_at: string;
}

export type CoverStoryAgencyInsert = Omit<CoverStoryAgency, "created_at"> & {
  created_at?: string;
  aliases?: string[];
  pop_culture?: boolean;
  playable?: boolean;
  active?: boolean;
  hr_safe?: boolean;
};

export interface CoverStoryAgencyWord {
  id: string;
  agency_id: number;
  ordinal: number;
  phrase: string;
  difficulty: number;
  created_at: string;
}

export type CoverStoryAgencyWordInsert = Omit<
  CoverStoryAgencyWord,
  "id" | "created_at"
> & {
  id?: string;
  created_at?: string;
};

export interface CoverStorySession {
  id: string;
  session_id: string;
  reveal_on: string | null;
  phase: CoverStoryPhase;
  reveal_order: string[];
  reveal_index: number;
  guess_started_at: string | null;
  guess_duration_seconds: number;
  reveal_subphase: CoverStoryRevealSubphase;
  created_at: string;
}

export type CoverStorySessionInsert = Omit<
  CoverStorySession,
  "id" | "created_at"
> & {
  id?: string;
  created_at?: string;
  reveal_on?: string | null;
  phase?: CoverStoryPhase;
  reveal_order?: string[];
  reveal_index?: number;
  guess_started_at?: string | null;
  guess_duration_seconds?: number;
  reveal_subphase?: CoverStoryRevealSubphase;
};

export interface CoverStoryDeal {
  id: string;
  cover_story_session_id: string;
  participant_id: string;
  shown_agency_ids: number[];
  locked_agency_id: number | null;
  locked_at: string | null;
  created_at: string;
}

export type CoverStoryDealInsert = Omit<CoverStoryDeal, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
  locked_agency_id?: number | null;
  locked_at?: string | null;
};

export interface CoverStoryWordLog {
  id: string;
  deal_id: string;
  word_id: string;
  status: CoverStoryWordLogStatus;
  planted_on: string | null;
  witness_ids: string[];
  note: string;
  updated_at: string;
}

export type CoverStoryWordLogInsert = Omit<
  CoverStoryWordLog,
  "id" | "updated_at"
> & {
  id?: string;
  updated_at?: string;
  status?: CoverStoryWordLogStatus;
  planted_on?: string | null;
  witness_ids?: string[];
  note?: string;
};

export interface CoverStoryGuess {
  id: string;
  cover_story_session_id: string;
  target_participant_id: string;
  guesser_participant_id: string;
  agency_text: string;
  evidence_text: string;
  submitted_at: string;
  suggested_correct: boolean;
  marked_correct: boolean | null;
}

export type CoverStoryGuessInsert = Omit<CoverStoryGuess, "id" | "submitted_at"> & {
  id?: string;
  submitted_at?: string;
  evidence_text?: string;
  suggested_correct?: boolean;
  marked_correct?: boolean | null;
};

export interface CoverStoryTargetResult {
  id: string;
  cover_story_session_id: string;
  target_participant_id: string;
  n: number;
  k: number;
  type1_score: number;
  mission_score: number;
  finalized_at: string;
}

export type CoverStoryTargetResultInsert = Omit<
  CoverStoryTargetResult,
  "id" | "finalized_at"
> & {
  id?: string;
  finalized_at?: string;
};

export type Database = {
  public: {
    Tables: {
      persons: {
        Row: Person;
        Insert: PersonInsert;
        Update: PersonUpdate;
        Relationships: [];
      };
      protocols: {
        Row: Protocol;
        Insert: ProtocolInsert;
        Update: ProtocolUpdate;
        Relationships: [];
      };
      teams: {
        Row: Team;
        Insert: TeamInsert;
        Update: TeamUpdate;
        Relationships: [];
      };
      team_roster: {
        Row: TeamRoster;
        Insert: TeamRosterInsert;
        Update: TeamRosterUpdate;
        Relationships: [];
      };
      participants: {
        Row: Participant;
        Insert: ParticipantInsert;
        Update: ParticipantUpdate;
        Relationships: [];
      };
      seasons: {
        Row: Season;
        Insert: SeasonInsert;
        Update: SeasonUpdate;
        Relationships: [];
      };
      protocol_slots: {
        Row: ProtocolSlot;
        Insert: ProtocolSlotInsert;
        Update: ProtocolSlotUpdate;
        Relationships: [];
      };
      sessions: {
        Row: Session;
        Insert: SessionInsert;
        Update: SessionUpdate;
        Relationships: [];
      };
      session_participants: {
        Row: SessionParticipant;
        Insert: SessionParticipantInsert;
        Update: SessionParticipantUpdate;
        Relationships: [];
      };
      session_state: {
        Row: SessionState;
        Insert: SessionStateInsert;
        Update: SessionStateUpdate;
        Relationships: [];
      };
      protocol_images: {
        Row: ProtocolImage;
        Insert: ProtocolImageInsert;
        Update: Partial<ProtocolImageInsert>;
        Relationships: [];
      };
      dibe_teams: {
        Row: DibeTeamRow;
        Insert: DibeTeamRowInsert;
        Update: Partial<DibeTeamRowInsert>;
        Relationships: [];
      };
      wao_questions: {
        Row: WaoQuestion;
        Insert: WaoQuestionInsert;
        Update: Partial<WaoQuestionInsert>;
        Relationships: [];
      };
      wao_question_items: {
        Row: WaoQuestionItem;
        Insert: WaoQuestionItemInsert;
        Update: Partial<WaoQuestionItemInsert>;
        Relationships: [];
      };
      wao_sessions: {
        Row: WaoSession;
        Insert: WaoSessionInsert;
        Update: Partial<WaoSessionInsert>;
        Relationships: [];
      };
      wao_rounds: {
        Row: WaoRound;
        Insert: WaoRoundInsert;
        Update: Partial<WaoRoundInsert>;
        Relationships: [];
      };
      wao_pairs: {
        Row: WaoPair;
        Insert: WaoPairInsert;
        Update: Partial<WaoPairInsert>;
        Relationships: [];
      };
      wao_taps: {
        Row: WaoTap;
        Insert: WaoTapInsert;
        Update: Partial<WaoTapInsert>;
        Relationships: [];
      };
      wao_round_results: {
        Row: WaoRoundResult;
        Insert: WaoRoundResultInsert;
        Update: Partial<WaoRoundResultInsert>;
        Relationships: [];
      };
      trane_courses: {
        Row: TraneCourse;
        Insert: TraneCourseInsert;
        Update: Partial<TraneCourseInsert>;
        Relationships: [];
      };
      trane_questions: {
        Row: TraneQuestion;
        Insert: TraneQuestionInsert;
        Update: Partial<TraneQuestionInsert>;
        Relationships: [];
      };
      trane_offerings: {
        Row: TraneOffering;
        Insert: TraneOfferingInsert;
        Update: Partial<TraneOfferingInsert>;
        Relationships: [];
      };
      trane_participants: {
        Row: TraneParticipant;
        Insert: TraneParticipantInsert;
        Update: Partial<TraneParticipantInsert>;
        Relationships: [];
      };
      trane_responses: {
        Row: TraneResponse;
        Insert: TraneResponseInsert;
        Update: Partial<TraneResponseInsert>;
        Relationships: [];
      };
      cover_story_agencies: {
        Row: CoverStoryAgency;
        Insert: CoverStoryAgencyInsert;
        Update: Partial<CoverStoryAgencyInsert>;
        Relationships: [];
      };
      cover_story_agency_words: {
        Row: CoverStoryAgencyWord;
        Insert: CoverStoryAgencyWordInsert;
        Update: Partial<CoverStoryAgencyWordInsert>;
        Relationships: [];
      };
      cover_story_sessions: {
        Row: CoverStorySession;
        Insert: CoverStorySessionInsert;
        Update: Partial<CoverStorySessionInsert>;
        Relationships: [];
      };
      cover_story_deals: {
        Row: CoverStoryDeal;
        Insert: CoverStoryDealInsert;
        Update: Partial<CoverStoryDealInsert>;
        Relationships: [];
      };
      cover_story_word_logs: {
        Row: CoverStoryWordLog;
        Insert: CoverStoryWordLogInsert;
        Update: Partial<CoverStoryWordLogInsert>;
        Relationships: [];
      };
      cover_story_guesses: {
        Row: CoverStoryGuess;
        Insert: CoverStoryGuessInsert;
        Update: Partial<CoverStoryGuessInsert>;
        Relationships: [];
      };
      cover_story_target_results: {
        Row: CoverStoryTargetResult;
        Insert: CoverStoryTargetResultInsert;
        Update: Partial<CoverStoryTargetResultInsert>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      generate_join_code: {
        Args: Record<string, never>;
        Returns: string;
      };
      generate_trane_join_code: {
        Args: Record<string, never>;
        Returns: string;
      };
      link_participant_to_person: {
        Args: {
          participant_uuid: string;
          person_uuid: string;
        };
        Returns: null;
      };
    };
  };
};
