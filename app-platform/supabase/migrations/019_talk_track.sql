-- Talk Track: content packs (minimal, this protocol only), cards, live session tables.

-- ---------------------------------------------------------------------------
-- Platform pack table (Talk Track Pack A only; do not backfill WAO/DIBE/Cover Story)
-- ---------------------------------------------------------------------------

CREATE TABLE public.content_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id uuid NOT NULL REFERENCES public.protocols (id) ON DELETE CASCADE,
  slug text NOT NULL,
  label text NOT NULL,
  subtitle text,
  sort_order integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_packs_slug_check CHECK (slug ~ '^[a-z0-9]+$'),
  CONSTRAINT content_packs_status_check CHECK (status IN ('active', 'draft', 'retired')),
  CONSTRAINT content_packs_protocol_slug_unique UNIQUE (protocol_id, slug)
);

CREATE INDEX content_packs_protocol_id_idx ON public.content_packs (protocol_id);

ALTER TABLE public.sessions
  ADD COLUMN content_pack_id uuid REFERENCES public.content_packs (id) ON DELETE RESTRICT;

CREATE INDEX sessions_content_pack_id_idx ON public.sessions (content_pack_id);

-- ---------------------------------------------------------------------------
-- Protocol row
-- ---------------------------------------------------------------------------

INSERT INTO public.protocols (slug, name, description, type, min_players, max_players)
VALUES (
  'talk-track',
  'Talk Track',
  'Teams build a spoken sentence one word at a time so a teammate can name the word on the card.',
  'realtime',
  4,
  20
)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Cards
-- ---------------------------------------------------------------------------

CREATE TABLE public.talk_track_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_pack_id uuid NOT NULL REFERENCES public.content_packs (id) ON DELETE RESTRICT,
  word_1 text NOT NULL,
  word_2 text NOT NULL,
  word_3 text NOT NULL,
  word_4 text NOT NULL,
  word_5 text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT talk_track_cards_word_1_len CHECK (char_length(btrim(word_1)) > 0),
  CONSTRAINT talk_track_cards_word_2_len CHECK (char_length(btrim(word_2)) > 0),
  CONSTRAINT talk_track_cards_word_3_len CHECK (char_length(btrim(word_3)) > 0),
  CONSTRAINT talk_track_cards_word_4_len CHECK (char_length(btrim(word_4)) > 0),
  CONSTRAINT talk_track_cards_word_5_len CHECK (char_length(btrim(word_5)) > 0)
);

CREATE INDEX talk_track_cards_pack_active_idx
  ON public.talk_track_cards (content_pack_id, active);

-- ---------------------------------------------------------------------------
-- Live session
-- ---------------------------------------------------------------------------

CREATE TABLE public.talk_track_sessions (
  session_id uuid PRIMARY KEY REFERENCES public.sessions (id) ON DELETE CASCADE,
  phase text NOT NULL DEFAULT 'lobby',
  cycle_index integer NOT NULL DEFAULT 1,
  team_order uuid[] NOT NULL DEFAULT '{}',
  next_team_index integer NOT NULL DEFAULT 0,
  current_turn_id uuid,
  paused boolean NOT NULL DEFAULT false,
  hold_started_at timestamptz,
  last_turn_points integer,
  last_turn_end_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT talk_track_sessions_phase_check CHECK (
    phase IN (
      'lobby',
      'team_reveal',
      'turn',
      'hold',
      'another_round',
      'final_scores'
    )
  ),
  CONSTRAINT talk_track_sessions_cycle_index_check CHECK (cycle_index >= 1),
  CONSTRAINT talk_track_sessions_next_team_index_check CHECK (next_team_index >= 0),
  CONSTRAINT talk_track_sessions_end_reason_check CHECK (
    last_turn_end_reason IS NULL
    OR last_turn_end_reason IN ('all_five', 'timer', 'abandoned', 'skipped')
  )
);

CREATE TABLE public.talk_track_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  name text NOT NULL,
  member_ids uuid[] NOT NULL,
  score integer NOT NULL DEFAULT 0,
  sort_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT talk_track_teams_member_ids_len CHECK (cardinality(member_ids) >= 4),
  CONSTRAINT talk_track_teams_session_name_unique UNIQUE (session_id, name),
  CONSTRAINT talk_track_teams_session_sort_unique UNIQUE (session_id, sort_index)
);

CREATE INDEX talk_track_teams_session_id_idx ON public.talk_track_teams (session_id);

CREATE TABLE public.talk_track_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.talk_track_teams (id) ON DELETE CASCADE,
  cycle_index integer NOT NULL,
  card_id uuid REFERENCES public.talk_track_cards (id) ON DELETE RESTRICT,
  guesser_id uuid REFERENCES public.participants (id) ON DELETE RESTRICT,
  train_ids uuid[] NOT NULL DEFAULT '{}',
  current_slot smallint NOT NULL DEFAULT 1,
  subphase text NOT NULL DEFAULT 'cluing',
  started_at timestamptz,
  ended_at timestamptz,
  end_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT talk_track_turns_cycle_index_check CHECK (cycle_index >= 1),
  CONSTRAINT talk_track_turns_current_slot_check CHECK (current_slot >= 1 AND current_slot <= 5),
  CONSTRAINT talk_track_turns_subphase_check CHECK (subphase IN ('cluing', 'guessing')),
  CONSTRAINT talk_track_turns_end_reason_check CHECK (
    end_reason IS NULL
    OR end_reason IN ('all_five', 'timer', 'abandoned', 'skipped')
  ),
  CONSTRAINT talk_track_turns_session_card_unique UNIQUE (session_id, card_id)
);

CREATE INDEX talk_track_turns_session_id_idx ON public.talk_track_turns (session_id);
CREATE INDEX talk_track_turns_team_id_idx ON public.talk_track_turns (team_id);

CREATE TABLE public.talk_track_word_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turn_id uuid NOT NULL REFERENCES public.talk_track_turns (id) ON DELETE CASCADE,
  slot smallint NOT NULL,
  outcome text NOT NULL DEFAULT 'unset',
  decided_by uuid REFERENCES public.participants (id) ON DELETE SET NULL,
  decided_at timestamptz,
  CONSTRAINT talk_track_word_results_slot_check CHECK (slot >= 1 AND slot <= 5),
  CONSTRAINT talk_track_word_results_outcome_check CHECK (
    outcome IN ('scored', 'passed', 'expired', 'unset')
  ),
  CONSTRAINT talk_track_word_results_turn_slot_unique UNIQUE (turn_id, slot)
);

CREATE INDEX talk_track_word_results_turn_id_idx ON public.talk_track_word_results (turn_id);

CREATE TABLE public.talk_track_score_nudges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.talk_track_teams (id) ON DELETE CASCADE,
  delta smallint NOT NULL,
  created_by uuid NOT NULL REFERENCES public.participants (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT talk_track_score_nudges_delta_check CHECK (delta IN (-1, 1))
);

CREATE INDEX talk_track_score_nudges_session_id_idx ON public.talk_track_score_nudges (session_id);

-- ---------------------------------------------------------------------------
-- Pack A + three fixture cards (lobby sample is not playable)
-- ---------------------------------------------------------------------------

INSERT INTO public.content_packs (protocol_id, slug, label, subtitle, sort_order, status)
SELECT p.id, 'a', 'Pack A', 'Fixture rehearsal cards', 1, 'active'
FROM public.protocols p
WHERE p.slug = 'talk-track'
ON CONFLICT (protocol_id, slug) DO NOTHING;

INSERT INTO public.talk_track_cards (
  content_pack_id, word_1, word_2, word_3, word_4, word_5, active
)
SELECT pack.id, 'SOCK', 'LADDER', 'MUSTARD', 'ASTRONAUT', 'PHOTOSYNTHESIS', false
FROM public.content_packs pack
JOIN public.protocols p ON p.id = pack.protocol_id
WHERE p.slug = 'talk-track' AND pack.slug = 'a';

INSERT INTO public.talk_track_cards (
  content_pack_id, word_1, word_2, word_3, word_4, word_5, active
)
SELECT pack.id, 'MAPLE', 'BICYCLE', 'WHISPER', 'CATALYST', 'EQUILIBRIUM', true
FROM public.content_packs pack
JOIN public.protocols p ON p.id = pack.protocol_id
WHERE p.slug = 'talk-track' AND pack.slug = 'a';

INSERT INTO public.talk_track_cards (
  content_pack_id, word_1, word_2, word_3, word_4, word_5, active
)
SELECT pack.id, 'TEAPOT', 'LANTERN', 'MOSAIC', 'HORIZON', 'PARADOX', true
FROM public.content_packs pack
JOIN public.protocols p ON p.id = pack.protocol_id
WHERE p.slug = 'talk-track' AND pack.slug = 'a';

-- ---------------------------------------------------------------------------
-- RLS: service role only for live tables and card words (guesser strip lives
-- in the play-state route). Pack metadata is readable.
-- ---------------------------------------------------------------------------

ALTER TABLE public.content_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talk_track_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talk_track_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talk_track_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talk_track_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talk_track_word_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talk_track_score_nudges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for now" ON public.content_packs
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.talk_track_cards
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.talk_track_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.talk_track_teams
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.talk_track_turns
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.talk_track_word_results
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.talk_track_score_nudges
  FOR ALL TO service_role USING (true) WITH CHECK (true);
