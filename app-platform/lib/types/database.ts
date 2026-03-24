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
}

export interface SessionState {
  id: string;
  session_id: string;
  current_round: number;
  phase: string;
  state_json: Json;
  updated_at: string;
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

export type Database = {
  public: {
    Tables: {
      persons: {
        Row: Person;
        Insert: PersonInsert;
        Update: PersonUpdate;
      };
      protocols: {
        Row: Protocol;
        Insert: ProtocolInsert;
        Update: ProtocolUpdate;
      };
      teams: {
        Row: Team;
        Insert: TeamInsert;
        Update: TeamUpdate;
      };
      team_roster: {
        Row: TeamRoster;
        Insert: TeamRosterInsert;
        Update: TeamRosterUpdate;
      };
      participants: {
        Row: Participant;
        Insert: ParticipantInsert;
        Update: ParticipantUpdate;
      };
      seasons: {
        Row: Season;
        Insert: SeasonInsert;
        Update: SeasonUpdate;
      };
      protocol_slots: {
        Row: ProtocolSlot;
        Insert: ProtocolSlotInsert;
        Update: ProtocolSlotUpdate;
      };
      sessions: {
        Row: Session;
        Insert: SessionInsert;
        Update: SessionUpdate;
      };
      session_participants: {
        Row: SessionParticipant;
        Insert: SessionParticipantInsert;
        Update: SessionParticipantUpdate;
      };
      session_state: {
        Row: SessionState;
        Insert: SessionStateInsert;
        Update: SessionStateUpdate;
      };
    };
    Views: Record<string, never>;
    Functions: {
      generate_join_code: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      link_participant_to_person: {
        Args: {
          participant_uuid: string;
          person_uuid: string;
        };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
