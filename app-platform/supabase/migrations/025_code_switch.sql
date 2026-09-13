-- SwitchCode: protocol row, Pack A words, live session tables.

INSERT INTO public.protocols (slug, name, description, type, min_players, max_players)
VALUES (
  'code-switch',
  'SwitchCode',
  'Clue givers write one secret word. Shared or Unique filters what the guesser sees. The team scores only if they type it.',
  'realtime',
  4,
  20
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.content_packs (protocol_id, slug, label, subtitle, sort_order, status)
SELECT p.id, 'a', 'Pack A', '53 mixed-difficulty words', 1, 'active'
FROM public.protocols p
WHERE p.slug = 'code-switch'
ON CONFLICT (protocol_id, slug) DO NOTHING;

CREATE TABLE public.code_switch_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_pack_id uuid NOT NULL REFERENCES public.content_packs (id) ON DELETE RESTRICT,
  word text NOT NULL,
  band text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT code_switch_words_word_len CHECK (char_length(btrim(word)) > 0),
  CONSTRAINT code_switch_words_band_check CHECK (band IN ('easy', 'medium', 'hard')),
  CONSTRAINT code_switch_words_pack_word_unique UNIQUE (content_pack_id, word)
);

CREATE INDEX code_switch_words_pack_active_idx
  ON public.code_switch_words (content_pack_id, active);

CREATE TABLE public.code_switch_sessions (
  session_id uuid PRIMARY KEY REFERENCES public.sessions (id) ON DELETE CASCADE,
  phase text NOT NULL DEFAULT 'write',
  team_score integer NOT NULL DEFAULT 0,
  current_round_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT code_switch_sessions_phase_check CHECK (
    phase IN ('write', 'guess', 'reveal', 'scoreboard')
  ),
  CONSTRAINT code_switch_sessions_team_score_check CHECK (team_score >= 0)
);

CREATE TABLE public.code_switch_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  round_index integer NOT NULL,
  guesser_id uuid NOT NULL REFERENCES public.participants (id) ON DELETE RESTRICT,
  word_id uuid NOT NULL REFERENCES public.code_switch_words (id) ON DELETE RESTRICT,
  round_type text NOT NULL,
  write_started_at timestamptz,
  guess_started_at timestamptz,
  filtered_clues_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  guess_text text,
  is_hit boolean,
  ended_at timestamptz,
  end_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT code_switch_rounds_round_index_check CHECK (round_index >= 1),
  CONSTRAINT code_switch_rounds_type_check CHECK (round_type IN ('shared', 'unique')),
  CONSTRAINT code_switch_rounds_end_reason_check CHECK (
    end_reason IS NULL OR end_reason IN ('guessed', 'timer', 'abandoned')
  ),
  CONSTRAINT code_switch_rounds_session_index_unique UNIQUE (session_id, round_index)
);

CREATE INDEX code_switch_rounds_session_id_idx ON public.code_switch_rounds (session_id);

ALTER TABLE public.code_switch_sessions
  ADD CONSTRAINT code_switch_sessions_current_round_fk
  FOREIGN KEY (current_round_id) REFERENCES public.code_switch_rounds (id) ON DELETE SET NULL;

CREATE TABLE public.code_switch_clues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.code_switch_rounds (id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants (id) ON DELETE RESTRICT,
  raw_text text NOT NULL,
  normalized text NOT NULL,
  survived boolean,
  locked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT code_switch_clues_round_participant_unique UNIQUE (round_id, participant_id)
);

CREATE INDEX code_switch_clues_round_id_idx ON public.code_switch_clues (round_id);

INSERT INTO public.code_switch_words (content_pack_id, word, band)
SELECT pack.id, w.word, w.band
FROM public.content_packs pack
JOIN public.protocols p ON p.id = pack.protocol_id
CROSS JOIN (
  VALUES
    ('APPLE', 'easy'),
    ('BALLOON', 'easy'),
    ('BICYCLE', 'easy'),
    ('BLANKET', 'easy'),
    ('CANDLE', 'easy'),
    ('COFFEE', 'easy'),
    ('ELEPHANT', 'easy'),
    ('GUITAR', 'easy'),
    ('HAMMER', 'easy'),
    ('LADDER', 'easy'),
    ('OCEAN', 'easy'),
    ('PENCIL', 'easy'),
    ('PIZZA', 'easy'),
    ('RAINBOW', 'easy'),
    ('SANDWICH', 'easy'),
    ('UMBRELLA', 'easy'),
    ('ASTRONAUT', 'medium'),
    ('BACKPACK', 'medium'),
    ('COMPASS', 'medium'),
    ('DAYDREAM', 'medium'),
    ('ELEVATOR', 'medium'),
    ('FIREPLACE', 'medium'),
    ('HONEYMOON', 'medium'),
    ('LIBRARY', 'medium'),
    ('LIGHTHOUSE', 'medium'),
    ('MUSEUM', 'medium'),
    ('ORCHESTRA', 'medium'),
    ('PASSPORT', 'medium'),
    ('RECIPE', 'medium'),
    ('SCAFFOLD', 'medium'),
    ('SUBWAY', 'medium'),
    ('TELESCOPE', 'medium'),
    ('VOLCANO', 'medium'),
    ('WEDDING', 'medium'),
    ('ALGORITHM', 'hard'),
    ('BLACKMAIL', 'hard'),
    ('BURNOUT', 'hard'),
    ('CAMOUFLAGE', 'hard'),
    ('CHECKPOINT', 'hard'),
    ('CLIFFHANGER', 'hard'),
    ('COMPROMISE', 'hard'),
    ('DIPLOMACY', 'hard'),
    ('FLASHBACK', 'hard'),
    ('HEARTBREAK', 'hard'),
    ('LOOPHOLE', 'hard'),
    ('NOSTALGIA', 'hard'),
    ('RESILIENCE', 'hard'),
    ('SABOTAGE', 'hard'),
    ('SCAPEGOAT', 'hard'),
    ('SERENDIPITY', 'hard'),
    ('STALEMATE', 'hard'),
    ('SUPERSTITION', 'hard'),
    ('ULTIMATUM', 'hard')
) AS w(word, band)
WHERE p.slug = 'code-switch' AND pack.slug = 'a';

ALTER TABLE public.code_switch_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_switch_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_switch_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_switch_clues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.code_switch_words
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.code_switch_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.code_switch_rounds
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.code_switch_clues
  FOR ALL TO service_role USING (true) WITH CHECK (true);
