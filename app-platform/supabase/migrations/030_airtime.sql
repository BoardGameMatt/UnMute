-- Airtime: protocol row and live session tables. Service role only.
-- Open session_state must not carry tanks, depths, items, or boat totals.
-- No content pack: the treasure deck is part of the tuned mechanic.

INSERT INTO public.protocols (slug, name, description, type, min_players, max_players)
VALUES (
  'airtime',
  'Airtime',
  'Boats share one oxygen tank. Dive deeper for better treasure, or swim back up and help your divers from the surface.',
  'realtime',
  2,
  16
)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE public.airtime_sessions (
  session_id uuid PRIMARY KEY REFERENCES public.sessions (id) ON DELETE CASCADE,
  phase text NOT NULL DEFAULT 'boats',
  revealed boolean NOT NULL DEFAULT false,
  revealed_after_dive integer,
  current_dive integer NOT NULL DEFAULT 0,
  current_turn integer NOT NULL DEFAULT 0,
  rules_ends_at timestamptz,
  window_opens_at timestamptz,
  turn_ends_at timestamptz,
  end_after_turn boolean NOT NULL DEFAULT false,
  end_banner_until timestamptz,
  show_highlight boolean NOT NULL DEFAULT false,
  show_names boolean NOT NULL DEFAULT false,
  -- Live DiveState (tanks, depths, items, shuffled decks). Secret.
  dive_state_json jsonb,
  -- Compare-and-set guard: every write that changes play state bumps it.
  version integer NOT NULL DEFAULT 0,
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT airtime_sessions_phase_check CHECK (
    phase IN ('boats', 'rules', 'dive_active', 'dive_results', 'final')
  ),
  CONSTRAINT airtime_sessions_dive_check CHECK (current_dive BETWEEN 0 AND 5)
);

CREATE TABLE public.airtime_boats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL,
  is_rival boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT airtime_boats_session_order_unique UNIQUE (session_id, sort_order)
);

CREATE INDEX airtime_boats_session_id_idx ON public.airtime_boats (session_id);

CREATE TABLE public.airtime_boat_members (
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  boat_id uuid NOT NULL REFERENCES public.airtime_boats (id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants (id) ON DELETE RESTRICT,
  PRIMARY KEY (session_id, participant_id)
);

CREATE INDEX airtime_boat_members_boat_id_idx ON public.airtime_boat_members (boat_id);

CREATE TABLE public.airtime_dives (
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  number integer NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  end_reason text,
  PRIMARY KEY (session_id, number),
  CONSTRAINT airtime_dives_number_check CHECK (number BETWEEN 1 AND 5),
  CONSTRAINT airtime_dives_end_reason_check CHECK (
    end_reason IS NULL OR end_reason IN ('all_back', 'max_turns', 'facilitator')
  )
);

-- Written when a dive ends. RV Belafonte rows carry its par as `result`.
CREATE TABLE public.airtime_boat_dives (
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  dive_number integer NOT NULL,
  boat_id uuid NOT NULL REFERENCES public.airtime_boats (id) ON DELETE CASCADE,
  tank_start integer NOT NULL DEFAULT 0,
  tank_by_turn integer[] NOT NULL DEFAULT '{}',
  result integer NOT NULL DEFAULT 0,
  PRIMARY KEY (session_id, dive_number, boat_id)
);

-- Written when a dive ends.
CREATE TABLE public.airtime_diver_dives (
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  dive_number integer NOT NULL,
  participant_id uuid NOT NULL REFERENCES public.participants (id) ON DELETE RESTRICT,
  boat_id uuid NOT NULL REFERENCES public.airtime_boats (id) ON DELETE CASCADE,
  path integer[] NOT NULL DEFAULT '{}',
  deepest integer NOT NULL,
  item_id text NOT NULL,
  status text NOT NULL,
  surfaced_turn integer,
  haul integer NOT NULL DEFAULT 0,
  PRIMARY KEY (session_id, dive_number, participant_id),
  CONSTRAINT airtime_diver_dives_status_check CHECK (
    status IN ('surfaced', 'lost', 'forfeit')
  )
);

-- Committed choices for the open decision window. One per diver per turn.
CREATE TABLE public.airtime_choices (
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  dive_number integer NOT NULL,
  turn integer NOT NULL,
  participant_id uuid NOT NULL REFERENCES public.participants (id) ON DELETE RESTRICT,
  choice text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, dive_number, turn, participant_id),
  CONSTRAINT airtime_choices_choice_check CHECK (choice IN ('deeper', 'up'))
);

-- Append-only. The only input to debrief metrics.
CREATE TABLE public.airtime_events (
  id bigserial PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  dive_number integer NOT NULL,
  turn integer NOT NULL,
  type text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX airtime_events_session_idx ON public.airtime_events (session_id, dive_number, turn);

ALTER TABLE public.airtime_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.airtime_boats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.airtime_boat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.airtime_dives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.airtime_boat_dives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.airtime_diver_dives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.airtime_choices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.airtime_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.airtime_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.airtime_boats
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.airtime_boat_members
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.airtime_dives
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.airtime_boat_dives
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.airtime_diver_dives
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.airtime_choices
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.airtime_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);
