-- Unmute Labs — initial schema (BRD Auth Addendum v1, revised Prompt 1B)
-- Aligns with .cursorrules: Person → Participant → Team → Season → Session → SessionState

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- generate_join_code: random 6-character UPPERCASE alphanumeric (A–Z, 0–9)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_join_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  alphabet constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result text := '';
  i integer;
  idx integer;
BEGIN
  FOR i IN 1..6 LOOP
    idx := floor(random() * length(alphabet))::integer + 1;
    result := result || substr(alphabet, idx, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- ---------------------------------------------------------------------------
-- Tables (dependency order)
-- ---------------------------------------------------------------------------

CREATE TABLE public.persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text,
  avatar_url text,
  auth_provider text,
  supabase_auth_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT persons_auth_provider_check CHECK (
    auth_provider IS NULL OR auth_provider IN ('google', 'microsoft')
  )
);

COMMENT ON CONSTRAINT persons_auth_provider_check ON public.persons IS
  'Nullable until first SSO; values match Supabase Auth providers.';

ALTER TABLE public.persons
  ADD CONSTRAINT persons_supabase_auth_id_fkey
  FOREIGN KEY (supabase_auth_id) REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE TABLE public.protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  type text NOT NULL,
  min_players integer NOT NULL DEFAULT 2,
  max_players integer NOT NULL DEFAULT 20,
  config_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT protocols_type_check CHECK (type IN ('realtime', 'turnbased', 'async'))
);

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  join_code text NOT NULL UNIQUE DEFAULT public.generate_join_code(),
  require_auth boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teams_join_code_len CHECK (char_length(join_code) = 6),
  CONSTRAINT teams_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.persons (id) ON DELETE SET NULL
);

CREATE TABLE public.participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams (id) ON DELETE CASCADE,
  person_id uuid REFERENCES public.persons (id) ON DELETE SET NULL,
  display_name text NOT NULL,
  role text NOT NULL,
  avatar_seed text,
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT participants_role_check CHECK (role IN ('lead', 'member')),
  CONSTRAINT participants_team_display_name_unique UNIQUE (team_id, display_name)
);

CREATE TABLE public.team_roster (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams (id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name_hint text,
  role text NOT NULL DEFAULT 'member',
  invited_at timestamptz NOT NULL DEFAULT now(),
  claimed_by uuid REFERENCES public.participants (id) ON DELETE SET NULL,
  CONSTRAINT team_roster_role_check CHECK (role IN ('lead', 'member')),
  CONSTRAINT team_roster_team_email_unique UNIQUE (team_id, email)
);

CREATE TABLE public.seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams (id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seasons_status_check CHECK (status IN ('draft', 'active', 'completed'))
);

CREATE TABLE public.protocol_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.seasons (id) ON DELETE CASCADE,
  protocol_id uuid NOT NULL REFERENCES public.protocols (id) ON DELETE RESTRICT,
  week_number integer NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  CONSTRAINT protocol_slots_season_week_unique UNIQUE (season_id, week_number)
);

CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id uuid NOT NULL REFERENCES public.protocols (id) ON DELETE RESTRICT,
  protocol_slot_id uuid REFERENCES public.protocol_slots (id) ON DELETE SET NULL,
  team_id uuid NOT NULL REFERENCES public.teams (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'lobby',
  join_code text NOT NULL UNIQUE DEFAULT public.generate_join_code(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sessions_status_check CHECK (status IN ('lobby', 'active', 'completed', 'cancelled')),
  CONSTRAINT sessions_join_code_len CHECK (char_length(join_code) = 6)
);

CREATE TABLE public.session_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants (id) ON DELETE CASCADE,
  role_in_session text NOT NULL,
  connected boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT session_participants_role_check CHECK (role_in_session IN ('lead', 'member')),
  CONSTRAINT session_participants_session_participant_unique UNIQUE (session_id, participant_id)
);

CREATE TABLE public.session_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL UNIQUE REFERENCES public.sessions (id) ON DELETE CASCADE,
  current_round integer NOT NULL DEFAULT 0,
  phase text NOT NULL DEFAULT 'waiting',
  state_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- link_participant_to_person: set participant.person_id + roster claimed_by
-- (defined after tables exist)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_participant_to_person(
  participant_uuid uuid,
  person_uuid uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p_team_id uuid;
  person_email text;
BEGIN
  SELECT email INTO person_email
  FROM public.persons
  WHERE id = person_uuid;

  IF person_email IS NULL THEN
    RAISE EXCEPTION 'Person not found: %', person_uuid;
  END IF;

  SELECT team_id INTO p_team_id
  FROM public.participants
  WHERE id = participant_uuid;

  IF p_team_id IS NULL THEN
    RAISE EXCEPTION 'Participant not found: %', participant_uuid;
  END IF;

  UPDATE public.participants
  SET person_id = person_uuid
  WHERE id = participant_uuid;

  UPDATE public.team_roster
  SET claimed_by = participant_uuid
  WHERE team_id = p_team_id
    AND lower(trim(email)) = lower(trim(person_email));
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_join_code() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.link_participant_to_person(uuid, uuid) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Supabase Realtime
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_participants;

-- ---------------------------------------------------------------------------
-- Row Level Security (permissive for now — tighten in Phase 5)
-- ---------------------------------------------------------------------------
ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocol_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for now" ON public.persons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for now" ON public.protocols FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for now" ON public.teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for now" ON public.team_roster FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for now" ON public.participants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for now" ON public.seasons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for now" ON public.protocol_slots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for now" ON public.sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for now" ON public.session_participants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for now" ON public.session_state FOR ALL USING (true) WITH CHECK (true);
