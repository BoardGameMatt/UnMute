-- Trane Quiz: isolated side product (not an Unmute Moment / protocol).
-- All access via service-role APIs that authorize host_token or participant cookie.

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------

CREATE TABLE public.trane_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  title text NOT NULL,
  revision_label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trane_courses_slug_unique UNIQUE (slug)
);

CREATE TABLE public.trane_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.trane_courses (id) ON DELETE CASCADE,
  sort_order smallint NOT NULL,
  stem text NOT NULL,
  options jsonb NOT NULL,
  correct_option text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trane_questions_sort_order_check CHECK (sort_order >= 1 AND sort_order <= 10),
  CONSTRAINT trane_questions_course_sort_unique UNIQUE (course_id, sort_order),
  CONSTRAINT trane_questions_options_is_array CHECK (jsonb_typeof(options) = 'array')
);

CREATE INDEX trane_questions_course_id_idx ON public.trane_questions (course_id);

-- ---------------------------------------------------------------------------
-- Offerings (one live class)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.generate_trane_join_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
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

CREATE TABLE public.trane_offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.trane_courses (id) ON DELETE RESTRICT,
  class_date date NOT NULL,
  label text,
  phase text NOT NULL DEFAULT 'waiting',
  join_code text NOT NULL DEFAULT public.generate_trane_join_code(),
  host_token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  CONSTRAINT trane_offerings_phase_check CHECK (
    phase IN ('waiting', 'pre_open', 'pre_closed', 'post_open', 'closed')
  ),
  CONSTRAINT trane_offerings_join_code_unique UNIQUE (join_code),
  CONSTRAINT trane_offerings_host_token_unique UNIQUE (host_token),
  CONSTRAINT trane_offerings_join_code_len CHECK (char_length(join_code) = 6)
);

CREATE INDEX trane_offerings_course_id_idx ON public.trane_offerings (course_id);

-- ---------------------------------------------------------------------------
-- Anonymous participants + responses
-- ---------------------------------------------------------------------------

CREATE TABLE public.trane_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id uuid NOT NULL REFERENCES public.trane_offerings (id) ON DELETE CASCADE,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  pre_completed_at timestamptz,
  post_completed_at timestamptz,
  post_unpaired boolean NOT NULL DEFAULT false,
  post_unpaired_confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trane_participants_offering_token_unique UNIQUE (offering_id, token)
);

CREATE INDEX trane_participants_offering_id_idx ON public.trane_participants (offering_id);

CREATE TABLE public.trane_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id uuid NOT NULL REFERENCES public.trane_offerings (id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.trane_participants (id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.trane_questions (id) ON DELETE RESTRICT,
  phase text NOT NULL,
  selected_option text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trane_responses_phase_check CHECK (phase IN ('pre', 'post')),
  CONSTRAINT trane_responses_unique UNIQUE (offering_id, participant_id, phase, question_id)
);

CREATE INDEX trane_responses_offering_phase_idx ON public.trane_responses (offering_id, phase);
CREATE INDEX trane_responses_participant_id_idx ON public.trane_responses (participant_id);

-- ---------------------------------------------------------------------------
-- RLS: service role only (no anon/authenticated policies)
-- ---------------------------------------------------------------------------

ALTER TABLE public.trane_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trane_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trane_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trane_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trane_responses ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.trane_courses TO service_role;
GRANT ALL ON public.trane_questions TO service_role;
GRANT ALL ON public.trane_offerings TO service_role;
GRANT ALL ON public.trane_participants TO service_role;
GRANT ALL ON public.trane_responses TO service_role;

GRANT EXECUTE ON FUNCTION public.generate_trane_join_code() TO service_role;
