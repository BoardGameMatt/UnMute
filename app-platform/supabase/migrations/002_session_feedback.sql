-- Post-session feedback (NPS-style 1–10 + optional comment)

CREATE TABLE public.session_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants (id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 10),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT session_feedback_session_participant_unique UNIQUE (session_id, participant_id),
  CONSTRAINT session_feedback_comment_len CHECK (comment IS NULL OR char_length(comment) <= 500)
);

CREATE INDEX session_feedback_session_id_idx ON public.session_feedback (session_id);

ALTER TABLE public.session_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for now" ON public.session_feedback FOR ALL USING (true) WITH CHECK (true);
