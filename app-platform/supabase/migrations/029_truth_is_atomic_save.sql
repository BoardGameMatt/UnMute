-- The Truth Is saves must not delete the truth rows in a step other
-- requests can read. One transaction locks the session, checks the write
-- version, then replaces the rows. A stale writer gets NULL and retries.

ALTER TABLE public.truth_is_sessions
  ADD COLUMN IF NOT EXISTS write_version integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.save_truth_is_snapshot(
  p_session_id uuid,
  p_expected_version integer,
  p_phase text,
  p_state_json jsonb,
  p_entries jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_current integer;
  v_next integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_session_id::text, 0));

  SELECT write_version
  INTO v_current
  FROM public.truth_is_sessions
  WHERE session_id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    IF p_expected_version <> 0 THEN
      RETURN NULL;
    END IF;

    INSERT INTO public.truth_is_sessions (session_id, phase, state_json, write_version)
    VALUES (p_session_id, p_phase, p_state_json, 1);
    v_next := 1;
  ELSIF v_current <> p_expected_version THEN
    RETURN NULL;
  ELSE
    v_next := v_current + 1;
    UPDATE public.truth_is_sessions
    SET phase = p_phase,
        state_json = p_state_json,
        write_version = v_next
    WHERE session_id = p_session_id;
  END IF;

  DELETE FROM public.truth_is_entries
  WHERE session_id = p_session_id;

  INSERT INTO public.truth_is_entries (
    id,
    session_id,
    author_id,
    text,
    round_submitted,
    used,
    guesses,
    correct_count
  )
  SELECT
    (e->>'id')::uuid,
    p_session_id,
    (e->>'author_id')::uuid,
    e->>'text',
    (e->>'round_submitted')::smallint,
    COALESCE((e->>'used')::boolean, false),
    COALESCE(e->'guesses', '{}'::jsonb),
    COALESCE((e->>'correct_count')::integer, 0)
  FROM jsonb_array_elements(COALESCE(p_entries, '[]'::jsonb)) AS e;

  RETURN v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.save_truth_is_snapshot(uuid, integer, text, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_truth_is_snapshot(uuid, integer, text, jsonb, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_truth_is_snapshot(uuid, integer, text, jsonb, jsonb) TO service_role;
