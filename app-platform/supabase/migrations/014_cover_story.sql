-- Cover Story: agency library, multi-week session, deals, logs, guesses, scores

-- ---------------------------------------------------------------------------
-- Library
-- ---------------------------------------------------------------------------

CREATE TABLE public.cover_story_agencies (
  id integer PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  official_name text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  kind text NOT NULL,
  pop_culture boolean NOT NULL DEFAULT false,
  tier smallint NOT NULL,
  playable boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  hr_safe boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cover_story_agencies_kind_check CHECK (
    kind IN (
      'natural_taxonomy',
      'food_drink',
      'procedural_terms',
      'manufactured_object',
      'proper_noun_set',
      'abstract_vocabulary',
      'pop_culture_property'
    )
  ),
  CONSTRAINT cover_story_agencies_tier_check CHECK (tier IN (1, 2, 3))
);

CREATE INDEX cover_story_agencies_active_playable_idx
  ON public.cover_story_agencies (active, playable);

CREATE TABLE public.cover_story_agency_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id integer NOT NULL REFERENCES public.cover_story_agencies (id) ON DELETE CASCADE,
  ordinal smallint NOT NULL,
  phrase text NOT NULL,
  difficulty smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cover_story_agency_words_ordinal_check CHECK (ordinal >= 1 AND ordinal <= 5),
  CONSTRAINT cover_story_agency_words_difficulty_check CHECK (difficulty >= 1 AND difficulty <= 5),
  CONSTRAINT cover_story_agency_words_agency_ordinal_unique UNIQUE (agency_id, ordinal)
);

CREATE INDEX cover_story_agency_words_agency_id_idx
  ON public.cover_story_agency_words (agency_id);

-- ---------------------------------------------------------------------------
-- Per-session durable state
-- ---------------------------------------------------------------------------

CREATE TABLE public.cover_story_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  reveal_on date,
  phase text NOT NULL DEFAULT 'lobby',
  reveal_order uuid[] NOT NULL DEFAULT '{}',
  reveal_index integer NOT NULL DEFAULT 0,
  guess_started_at timestamptz,
  guess_duration_seconds integer NOT NULL DEFAULT 90,
  reveal_subphase text NOT NULL DEFAULT 'guess',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cover_story_sessions_session_id_unique UNIQUE (session_id),
  CONSTRAINT cover_story_sessions_phase_check CHECK (
    phase IN (
      'lobby',
      'reading',
      'discuss',
      'insights',
      'deal',
      'field',
      'reveal',
      'complete'
    )
  ),
  CONSTRAINT cover_story_sessions_reveal_index_check CHECK (reveal_index >= 0),
  CONSTRAINT cover_story_sessions_guess_duration_check CHECK (guess_duration_seconds > 0),
  CONSTRAINT cover_story_sessions_reveal_subphase_check CHECK (
    reveal_subphase IN ('guess', 'gallery', 'mark', 'board', 'points', 'final')
  )
);

CREATE TABLE public.cover_story_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cover_story_session_id uuid NOT NULL REFERENCES public.cover_story_sessions (id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants (id) ON DELETE CASCADE,
  shown_agency_ids integer[] NOT NULL,
  locked_agency_id integer REFERENCES public.cover_story_agencies (id) ON DELETE RESTRICT,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cover_story_deals_shown_len_check CHECK (cardinality(shown_agency_ids) = 3),
  CONSTRAINT cover_story_deals_session_participant_unique UNIQUE (cover_story_session_id, participant_id)
);

CREATE INDEX cover_story_deals_session_id_idx
  ON public.cover_story_deals (cover_story_session_id);

CREATE TABLE public.cover_story_word_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.cover_story_deals (id) ON DELETE CASCADE,
  word_id uuid NOT NULL REFERENCES public.cover_story_agency_words (id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'open',
  planted_on date,
  witness_ids uuid[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cover_story_word_logs_status_check CHECK (
    status IN ('open', 'planted', 'not_planted')
  ),
  CONSTRAINT cover_story_word_logs_deal_word_unique UNIQUE (deal_id, word_id),
  CONSTRAINT cover_story_word_logs_planted_shape_check CHECK (
    (status = 'planted' AND planted_on IS NOT NULL AND cardinality(witness_ids) >= 2)
    OR (status <> 'planted')
  )
);

CREATE INDEX cover_story_word_logs_deal_id_idx
  ON public.cover_story_word_logs (deal_id);

CREATE TABLE public.cover_story_guesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cover_story_session_id uuid NOT NULL REFERENCES public.cover_story_sessions (id) ON DELETE CASCADE,
  target_participant_id uuid NOT NULL REFERENCES public.participants (id) ON DELETE CASCADE,
  guesser_participant_id uuid NOT NULL REFERENCES public.participants (id) ON DELETE CASCADE,
  agency_text text NOT NULL,
  evidence_text text NOT NULL DEFAULT '',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  suggested_correct boolean NOT NULL DEFAULT false,
  marked_correct boolean,
  CONSTRAINT cover_story_guesses_agency_len_check CHECK (char_length(agency_text) <= 50),
  CONSTRAINT cover_story_guesses_evidence_len_check CHECK (char_length(evidence_text) <= 250),
  CONSTRAINT cover_story_guesses_not_self_check CHECK (
    target_participant_id <> guesser_participant_id
  ),
  CONSTRAINT cover_story_guesses_unique UNIQUE (
    cover_story_session_id,
    target_participant_id,
    guesser_participant_id
  )
);

CREATE INDEX cover_story_guesses_session_target_idx
  ON public.cover_story_guesses (cover_story_session_id, target_participant_id);

CREATE TABLE public.cover_story_target_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cover_story_session_id uuid NOT NULL REFERENCES public.cover_story_sessions (id) ON DELETE CASCADE,
  target_participant_id uuid NOT NULL REFERENCES public.participants (id) ON DELETE CASCADE,
  n integer NOT NULL,
  k integer NOT NULL,
  type1_score integer NOT NULL,
  mission_score integer NOT NULL,
  finalized_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cover_story_target_results_n_check CHECK (n >= 0),
  CONSTRAINT cover_story_target_results_k_check CHECK (k >= 0 AND k <= n),
  CONSTRAINT cover_story_target_results_type1_check CHECK (type1_score >= 0),
  CONSTRAINT cover_story_target_results_mission_check CHECK (mission_score IN (0, 15)),
  CONSTRAINT cover_story_target_results_unique UNIQUE (
    cover_story_session_id,
    target_participant_id
  )
);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- cover_story_sessions is metadata (phase, reveal date) and follows the
-- permissive pattern. Everything that names an agency, a word, or a guess is
-- service_role only. Cookie gates in application code are the access control.
-- ---------------------------------------------------------------------------

ALTER TABLE public.cover_story_agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cover_story_agency_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cover_story_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cover_story_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cover_story_word_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cover_story_guesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cover_story_target_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.cover_story_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.cover_story_agencies
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.cover_story_agency_words
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.cover_story_deals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.cover_story_word_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.cover_story_guesses
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.cover_story_target_results
  FOR ALL TO service_role USING (true) WITH CHECK (true);
