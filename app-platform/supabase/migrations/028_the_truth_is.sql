-- The Truth Is: private session + entries. Service role only.
-- Open session_state must not carry author ids or unread lines.

INSERT INTO public.protocols (slug, name, description, type, min_players, max_players)
VALUES (
  'the-truth-is',
  'The Truth Is...',
  'Anonymous truths, read aloud, guess the author — structured vulnerability for teams.',
  'turnbased',
  3,
  20
)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE public.truth_is_sessions (
  session_id uuid PRIMARY KEY REFERENCES public.sessions (id) ON DELETE CASCADE,
  phase text NOT NULL,
  state_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT truth_is_sessions_phase_check CHECK (
    phase IN (
      'SUBMISSION_1',
      'SUBMISSION_2',
      'READING_ASSIGNMENT',
      'BLUFF_RULES',
      'DISCUSSION',
      'VOTING',
      'REVEAL',
      'LEADERBOARD',
      'WRAP_UP',
      'RESULTS'
    )
  )
);

CREATE TABLE public.truth_is_entries (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.participants (id) ON DELETE CASCADE,
  text text NOT NULL,
  round_submitted smallint NOT NULL,
  used boolean NOT NULL DEFAULT false,
  guesses jsonb NOT NULL DEFAULT '{}'::jsonb,
  correct_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT truth_is_entries_round_check CHECK (round_submitted IN (1, 2)),
  CONSTRAINT truth_is_entries_text_len CHECK (
    char_length(text) > 0 AND char_length(text) <= 300
  )
);

CREATE INDEX truth_is_entries_session_id_idx ON public.truth_is_entries (session_id);

ALTER TABLE public.truth_is_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.truth_is_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.truth_is_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.truth_is_entries
  FOR ALL TO service_role USING (true) WITH CHECK (true);
