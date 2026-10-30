-- Wrong Answers Only: question library, per-session rounds, pair selection state

-- ---------------------------------------------------------------------------
-- Question library
-- ---------------------------------------------------------------------------

CREATE TABLE public.wao_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_title text NOT NULL,
  disambiguation_rule text NOT NULL,
  disambiguation_detail text,
  correct_count smallint NOT NULL CHECK (correct_count >= 1 AND correct_count <= 5),
  difficulty smallint NOT NULL CHECK (difficulty >= 1 AND difficulty <= 5),
  region_tag text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wao_questions_region_tag_check CHECK (region_tag IN ('us', 'intl', 'global')),
  CONSTRAINT wao_questions_disambiguation_rule_len CHECK (char_length(disambiguation_rule) <= 140)
);

CREATE INDEX wao_questions_active_idx ON public.wao_questions (active);

CREATE TABLE public.wao_question_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.wao_questions (id) ON DELETE CASCADE,
  label text NOT NULL,
  is_correct boolean NOT NULL,
  trap_tier text NOT NULL,
  source_1_url text,
  source_1_note text,
  source_2_url text,
  source_2_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wao_question_items_trap_tier_check CHECK (trap_tier IN ('gimme', 'graded', 'trap')),
  CONSTRAINT wao_question_items_question_label_unique UNIQUE (question_id, label)
);

CREATE INDEX wao_question_items_question_id_idx ON public.wao_question_items (question_id);

-- ---------------------------------------------------------------------------
-- Session, rounds, pairs
-- ---------------------------------------------------------------------------

CREATE TABLE public.wao_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  timer_seconds integer NOT NULL DEFAULT 90,
  round_count integer NOT NULL DEFAULT 4,
  follow_window_seconds integer NOT NULL DEFAULT 8,
  concurrence_rate numeric(5,2),
  paired_round_count integer,
  exact_match_round_count integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wao_sessions_session_id_unique UNIQUE (session_id),
  CONSTRAINT wao_sessions_timer_seconds_check CHECK (timer_seconds > 0),
  CONSTRAINT wao_sessions_round_count_check CHECK (round_count >= 1),
  CONSTRAINT wao_sessions_follow_window_check CHECK (follow_window_seconds > 0),
  CONSTRAINT wao_sessions_concurrence_rate_check
    CHECK (concurrence_rate IS NULL OR (concurrence_rate >= 0 AND concurrence_rate <= 100))
);

CREATE TABLE public.wao_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wao_session_id uuid NOT NULL REFERENCES public.wao_sessions (id) ON DELETE CASCADE,
  round_number smallint NOT NULL,
  question_id uuid NOT NULL REFERENCES public.wao_questions (id) ON DELETE RESTRICT,
  is_sample boolean NOT NULL DEFAULT false,
  started_at timestamptz,
  locked_at timestamptz,
  lock_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wao_rounds_round_number_check CHECK (round_number >= 0),
  CONSTRAINT wao_rounds_lock_reason_check
    CHECK (lock_reason IS NULL OR lock_reason IN ('both_locked', 'timer')),
  CONSTRAINT wao_rounds_session_round_unique UNIQUE (wao_session_id, round_number),
  CONSTRAINT wao_rounds_session_question_unique UNIQUE (wao_session_id, question_id)
);

CREATE INDEX wao_rounds_wao_session_id_idx ON public.wao_rounds (wao_session_id);

CREATE TABLE public.wao_pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.wao_rounds (id) ON DELETE CASCADE,
  participant_a uuid NOT NULL REFERENCES public.participants (id) ON DELETE RESTRICT,
  participant_b uuid REFERENCES public.participants (id) ON DELETE RESTRICT,
  is_solo boolean NOT NULL DEFAULT false,
  relaxation_note text,
  locked_a_at timestamptz,
  locked_b_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wao_pairs_solo_shape_check CHECK (
    (is_solo AND participant_b IS NULL) OR (NOT is_solo AND participant_b IS NOT NULL)
  ),
  CONSTRAINT wao_pairs_distinct_members_check
    CHECK (participant_b IS NULL OR participant_a <> participant_b),
  CONSTRAINT wao_pairs_round_participant_a_unique UNIQUE (round_id, participant_a)
);

CREATE INDEX wao_pairs_round_id_idx ON public.wao_pairs (round_id);

-- ---------------------------------------------------------------------------
-- Tap log and results
-- ---------------------------------------------------------------------------

CREATE TABLE public.wao_taps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id uuid NOT NULL REFERENCES public.wao_pairs (id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants (id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.wao_question_items (id) ON DELETE RESTRICT,
  action text NOT NULL,
  client_seq integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wao_taps_action_check CHECK (action IN ('select', 'deselect')),
  CONSTRAINT wao_taps_client_seq_check CHECK (client_seq >= 0),
  CONSTRAINT wao_taps_pair_participant_seq_unique UNIQUE (pair_id, participant_id, client_seq)
);

CREATE INDEX wao_taps_pair_id_idx ON public.wao_taps (pair_id);
CREATE INDEX wao_taps_pair_id_participant_id_idx ON public.wao_taps (pair_id, participant_id);

CREATE TABLE public.wao_round_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id uuid NOT NULL REFERENCES public.wao_pairs (id) ON DELETE CASCADE,
  submitted_item_ids uuid[] NOT NULL DEFAULT '{}',
  score integer NOT NULL DEFAULT 0,
  bonus integer NOT NULL DEFAULT 0,
  lott integer NOT NULL DEFAULT 0,
  had_save boolean NOT NULL DEFAULT false,
  exact_match boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wao_round_results_pair_id_unique UNIQUE (pair_id),
  CONSTRAINT wao_round_results_score_check CHECK (score >= 0),
  CONSTRAINT wao_round_results_bonus_check CHECK (bonus >= 0),
  CONSTRAINT wao_round_results_lott_check CHECK (lott >= 0)
);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Two tiers, deliberately. Reference data that is already on the shared screen
-- follows the permissive pattern the other protocol tables use. Anything that
-- carries the answer key or one pair's private selection state is restricted to
-- service_role, so an anon key cannot read it at all.
--
-- Enabling RLS with no anon or authenticated policy denies those roles by
-- default. service_role bypasses RLS; the explicit policies below exist so the
-- intent is readable in this file rather than implied by an absence.
-- ---------------------------------------------------------------------------

ALTER TABLE public.wao_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wao_question_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wao_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wao_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wao_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wao_taps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wao_round_results ENABLE ROW LEVEL SECURITY;

-- Question metadata without the per-item answer key. Category title and
-- disambiguation rule are on the shared screen and both phones during play.
CREATE POLICY "Allow all for now" ON public.wao_questions FOR ALL USING (true) WITH CHECK (true);

-- Session config and round sequence. No selection state, no answer key.
CREATE POLICY "Allow all for now" ON public.wao_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for now" ON public.wao_rounds FOR ALL USING (true) WITH CHECK (true);

-- Answer key. is_correct decides the zero rule, so a readable copy on the
-- client defeats the question. Items reach participants through the server with
-- is_correct withheld until the reveal.
CREATE POLICY "Service role only" ON public.wao_question_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Pair membership and lock timestamps. Readable pair rows let a participant
-- enumerate who is paired with whom before the round is revealed.
CREATE POLICY "Service role only" ON public.wao_pairs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Private selection state. Spec 7.2 requires that a participant with dev tools
-- open cannot read another pair's selections. Denying the anon key outright is
-- the only form of that guarantee available while guest participants have no
-- database identity to write a row-level predicate against.
CREATE POLICY "Service role only" ON public.wao_taps
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Per-pair scores, including the LOTT and Save flags that are debrief content.
CREATE POLICY "Service role only" ON public.wao_round_results
  FOR ALL TO service_role USING (true) WITH CHECK (true);
