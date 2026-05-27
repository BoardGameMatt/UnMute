-- I Know What You Meme: persisted GIF selections per session participant

CREATE TABLE public.ikwym_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.session_participants (id) ON DELETE CASCADE,
  gif_url text NOT NULL,
  open_response text NOT NULL,
  stimulus_response text NOT NULL,
  search_query text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ikwym_responses_session_participant_unique UNIQUE (session_id, participant_id)
);

CREATE INDEX ikwym_responses_session_id_idx ON public.ikwym_responses (session_id);

ALTER TABLE public.ikwym_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ikwym_responses_session_access" ON public.ikwym_responses
  FOR ALL
  USING (true)
  WITH CHECK (true);
