-- I Know What You Meme: protocol row, Pack A prompts, live session tables.

INSERT INTO public.protocols (slug, name, description, type, min_players, max_players)
VALUES (
  'i-know-what-you-meme',
  'I Know What You Meme',
  'Answer the same two prompts with a GIF, then guess who picked each one.',
  'turnbased',
  3,
  20
)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Prompt library (Pack A)
-- ---------------------------------------------------------------------------

CREATE TABLE public.ikwym_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_pack_id uuid NOT NULL REFERENCES public.content_packs (id) ON DELETE RESTRICT,
  kind text NOT NULL,
  label text NOT NULL,
  prompt text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ikwym_prompts_kind_check CHECK (kind IN ('checkin', 'stimulus')),
  CONSTRAINT ikwym_prompts_label_len CHECK (char_length(btrim(label)) > 0),
  CONSTRAINT ikwym_prompts_prompt_len CHECK (char_length(btrim(prompt)) > 0)
);

CREATE INDEX ikwym_prompts_pack_kind_active_idx
  ON public.ikwym_prompts (content_pack_id, kind, active);

-- ---------------------------------------------------------------------------
-- Live session
-- ---------------------------------------------------------------------------

CREATE TABLE public.ikwym_sessions (
  session_id uuid PRIMARY KEY REFERENCES public.sessions (id) ON DELETE CASCADE,
  phase text NOT NULL DEFAULT 'R1_PROMPTS',
  round_index smallint NOT NULL DEFAULT 1,
  r1_checkin_id uuid NOT NULL REFERENCES public.ikwym_prompts (id) ON DELETE RESTRICT,
  r1_stimulus_id uuid NOT NULL REFERENCES public.ikwym_prompts (id) ON DELETE RESTRICT,
  r2_checkin_id uuid NOT NULL REFERENCES public.ikwym_prompts (id) ON DELETE RESTRICT,
  r2_stimulus_id uuid NOT NULL REFERENCES public.ikwym_prompts (id) ON DELETE RESTRICT,
  current_reveal_item_id uuid,
  guess_started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ikwym_sessions_phase_check CHECK (
    phase IN (
      'R1_PROMPTS',
      'R1_SELECTING',
      'R2_PROMPTS',
      'R2_SELECTING',
      'REVEAL_GUESS',
      'REVEAL_SHOW',
      'SCOREBOARD'
    )
  ),
  CONSTRAINT ikwym_sessions_round_check CHECK (round_index IN (1, 2))
);

CREATE TABLE public.ikwym_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants (id) ON DELETE CASCADE,
  round smallint NOT NULL,
  gif_url text NOT NULL,
  open_response text NOT NULL,
  stimulus_response text NOT NULL,
  search_query text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ikwym_responses_round_check CHECK (round IN (1, 2)),
  CONSTRAINT ikwym_responses_session_participant_round_unique UNIQUE (session_id, participant_id, round)
);

CREATE INDEX ikwym_responses_session_id_idx ON public.ikwym_responses (session_id);

CREATE TABLE public.ikwym_reveal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  sort_index integer NOT NULL,
  round smallint NOT NULL,
  owner_id uuid NOT NULL REFERENCES public.participants (id) ON DELETE RESTRICT,
  gif_url text NOT NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ikwym_reveal_items_round_check CHECK (round IN (1, 2)),
  CONSTRAINT ikwym_reveal_items_session_sort_unique UNIQUE (session_id, sort_index)
);

CREATE INDEX ikwym_reveal_items_session_id_idx ON public.ikwym_reveal_items (session_id);

ALTER TABLE public.ikwym_sessions
  ADD CONSTRAINT ikwym_sessions_current_reveal_item_fk
  FOREIGN KEY (current_reveal_item_id) REFERENCES public.ikwym_reveal_items (id) ON DELETE SET NULL;

CREATE TABLE public.ikwym_guesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reveal_item_id uuid NOT NULL REFERENCES public.ikwym_reveal_items (id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants (id) ON DELETE CASCADE,
  guessed_participant_id uuid NOT NULL REFERENCES public.participants (id) ON DELETE CASCADE,
  locked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ikwym_guesses_item_participant_unique UNIQUE (reveal_item_id, participant_id)
);

CREATE INDEX ikwym_guesses_reveal_item_id_idx ON public.ikwym_guesses (reveal_item_id);

-- ---------------------------------------------------------------------------
-- Pack A
-- ---------------------------------------------------------------------------

INSERT INTO public.content_packs (protocol_id, slug, label, subtitle, sort_order, status)
SELECT p.id, 'a', 'Pack A', '5 check-ins and 6 stimulus categories', 1, 'active'
FROM public.protocols p
WHERE p.slug = 'i-know-what-you-meme'
ON CONFLICT (protocol_id, slug) DO NOTHING;

INSERT INTO public.ikwym_prompts (content_pack_id, kind, label, prompt, active, sort_order)
SELECT pack.id, 'checkin', n.label, n.prompt, true, n.sort_order
FROM public.content_packs pack
JOIN public.protocols p ON p.id = pack.protocol_id
CROSS JOIN (
  SELECT * FROM (VALUES
    (1, 'Showing up', 'How are you showing up today?'),
    (2, 'Last week', 'Describe last week in one word'),
    (3, 'This week', 'How are you expecting this week to go?'),
    (4, 'Energy', 'What''s your energy level right now?'),
    (5, 'Weather', 'If today were a weather pattern, what would it be?')
  ) AS t(sort_order, label, prompt)
) n
WHERE p.slug = 'i-know-what-you-meme' AND pack.slug = 'a';

INSERT INTO public.ikwym_prompts (content_pack_id, kind, label, prompt, active, sort_order)
SELECT pack.id, 'stimulus', n.label, n.prompt, true, n.sort_order
FROM public.content_packs pack
JOIN public.protocols p ON p.id = pack.protocol_id
CROSS JOIN (
  SELECT * FROM (VALUES
    (1, 'Pop culture', 'Name a pop culture figure'),
    (2, 'Historical', 'Name a historical figure'),
    (3, 'Animal', 'Name an animal'),
    (4, 'Movie character', 'Name a movie character'),
    (5, 'Food', 'Name a food'),
    (6, 'TV character', 'Name a TV show character')
  ) AS t(sort_order, label, prompt)
) n
WHERE p.slug = 'i-know-what-you-meme' AND pack.slug = 'a';

-- ---------------------------------------------------------------------------
-- RLS: service role only (play DTO strips owner / others' GIFs)
-- ---------------------------------------------------------------------------

ALTER TABLE public.ikwym_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ikwym_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ikwym_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ikwym_reveal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ikwym_guesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.ikwym_prompts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.ikwym_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.ikwym_responses
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.ikwym_reveal_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.ikwym_guesses
  FOR ALL TO service_role USING (true) WITH CHECK (true);
