-- Related phase, turn, score and public-state writes share one transaction.
-- Engine decisions remain in TypeScript. These functions only validate the
-- persistence preconditions and commit the supplied decision atomically.
BEGIN;

CREATE OR REPLACE FUNCTION public.publish_workshop_state(
  p_session_id uuid, p_key text, p_phase text, p_extra jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  UPDATE public.session_state
  SET phase = p_phase,
      state_json = state_json || jsonb_build_object(p_key,
        p_extra || jsonb_build_object('phase', p_phase, 't', floor(extract(epoch FROM clock_timestamp()) * 1000))),
      updated_at = clock_timestamp()
  WHERE session_id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session state is missing'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.commit_code_switch_transition(
  p_session_id uuid, p_round_id uuid, p_expected_phase text, p_next_phase text,
  p_round_patch jsonb, p_clues jsonb, p_score_delta integer,
  p_extra jsonb DEFAULT '{}'::jsonb
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_session public.code_switch_sessions%ROWTYPE;
  v_round public.code_switch_rounds%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM public.code_switch_sessions WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND OR v_session.phase IS DISTINCT FROM p_expected_phase OR v_session.current_round_id IS DISTINCT FROM p_round_id THEN
    RETURN false;
  END IF;
  SELECT * INTO v_round FROM public.code_switch_rounds WHERE id = p_round_id AND session_id = p_session_id FOR UPDATE;
  IF NOT FOUND OR v_round.ended_at IS NOT NULL THEN RETURN false; END IF;
  IF NOT ((p_expected_phase = 'write' AND p_next_phase IN ('guess', 'reveal'))
    OR (p_expected_phase = 'guess' AND p_next_phase = 'reveal'))
    OR p_score_delta NOT IN (0, 1) THEN RAISE EXCEPTION 'Invalid transition'; END IF;
  IF jsonb_typeof(p_round_patch) <> 'object' OR EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_round_patch) k
    WHERE k NOT IN ('filtered_clues_json', 'guess_started_at', 'guess_text', 'is_hit', 'ended_at', 'end_reason')
  ) THEN RAISE EXCEPTION 'Invalid round patch'; END IF;

  IF p_next_phase = 'guess' THEN
    -- Clues may have arrived while the coordinator computed the filter. Its
    -- entire snapshot must still match; otherwise recompute using fresh input.
    IF p_clues IS NULL OR jsonb_typeof(p_clues) <> 'array' THEN RAISE EXCEPTION 'Clue snapshot required'; END IF;
    IF (SELECT count(*) FROM public.code_switch_clues WHERE round_id = p_round_id) <> jsonb_array_length(p_clues)
      OR (SELECT count(DISTINCT c.id) FROM public.code_switch_clues c
        JOIN jsonb_array_elements(p_clues) x ON c.id = (x->>'id')::uuid AND c.normalized = x->>'normalized'
        WHERE c.round_id = p_round_id) <> jsonb_array_length(p_clues) THEN RETURN false; END IF;
    UPDATE public.code_switch_clues c SET survived = (x->>'survived')::boolean
    FROM jsonb_array_elements(p_clues) x WHERE c.id = (x->>'id')::uuid AND c.round_id = p_round_id;
  END IF;

  v_round := jsonb_populate_record(v_round, p_round_patch);
  IF p_next_phase = 'guess' AND v_round.guess_started_at IS NULL THEN RAISE EXCEPTION 'Guess timer required'; END IF;
  IF p_next_phase = 'reveal' AND (v_round.ended_at IS NULL OR v_round.end_reason IS NULL) THEN
    RAISE EXCEPTION 'Completed round required';
  END IF;
  UPDATE public.code_switch_rounds SET
    filtered_clues_json = v_round.filtered_clues_json, guess_started_at = v_round.guess_started_at,
    guess_text = v_round.guess_text, is_hit = v_round.is_hit, ended_at = v_round.ended_at, end_reason = v_round.end_reason
  WHERE id = p_round_id;
  UPDATE public.code_switch_sessions SET phase = p_next_phase, team_score = team_score + p_score_delta
  WHERE session_id = p_session_id;
  PERFORM public.publish_workshop_state(p_session_id, 'codeSwitch', p_next_phase, p_extra);
  RETURN true;
END;
$$;

-- The same lock serializes clue admission with the transition snapshot above.
CREATE OR REPLACE FUNCTION public.lock_code_switch_clue(
  p_session_id uuid, p_round_id uuid, p_participant_id uuid, p_raw_text text, p_normalized text
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_session public.code_switch_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM public.code_switch_sessions WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND OR v_session.phase <> 'write' OR v_session.current_round_id IS DISTINCT FROM p_round_id THEN RETURN false; END IF;
  INSERT INTO public.code_switch_clues(round_id, participant_id, raw_text, normalized)
  VALUES (p_round_id, p_participant_id, p_raw_text, p_normalized)
  ON CONFLICT (round_id, participant_id) DO NOTHING;
  PERFORM public.publish_workshop_state(p_session_id, 'codeSwitch', 'write');
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.commit_say_less_turn(
  p_session_id uuid, p_expected_version integer, p_turn_id uuid,
  p_patch jsonb, p_event jsonb, p_end_reason text
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_session public.say_less_sessions%ROWTYPE;
  v_next public.say_less_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM public.say_less_sessions WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND OR v_session.version IS DISTINCT FROM p_expected_version
    OR v_session.current_turn_id IS DISTINCT FROM p_turn_id THEN RETURN false; END IF;
  IF jsonb_typeof(p_patch) <> 'object' OR EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN (
      'phase', 'pile_card_ids', 'current_turn_id', 'phase_deadline', 'hold_started_at', 'paused',
      'last_turn_got_it', 'last_turn_end_reason', 'round_1_ended_early', 'round_2_ended_early'
    )
  ) THEN RAISE EXCEPTION 'Invalid turn patch'; END IF;
  IF p_turn_id IS NOT NULL THEN
    PERFORM 1 FROM public.say_less_turns WHERE id = p_turn_id AND session_id = p_session_id AND ended_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RETURN false; END IF;
  ELSIF p_event IS NOT NULL OR p_end_reason IS NOT NULL THEN
    RAISE EXCEPTION 'Turn required';
  END IF;

  v_next := jsonb_populate_record(v_session, p_patch);
  UPDATE public.say_less_sessions SET
    phase = v_next.phase, pile_card_ids = v_next.pile_card_ids, current_turn_id = v_next.current_turn_id,
    phase_deadline = v_next.phase_deadline, hold_started_at = v_next.hold_started_at, paused = v_next.paused,
    last_turn_got_it = v_next.last_turn_got_it, last_turn_end_reason = v_next.last_turn_end_reason,
    round_1_ended_early = v_next.round_1_ended_early, round_2_ended_early = v_next.round_2_ended_early,
    version = version + 1
  WHERE session_id = p_session_id;
  IF p_event IS NOT NULL THEN
    INSERT INTO public.say_less_card_events(turn_id, card_id, outcome)
    VALUES (p_turn_id, (p_event->>'cardId')::uuid, p_event->>'outcome');
  END IF;
  IF p_end_reason IS NOT NULL THEN
    UPDATE public.say_less_turns SET ended_at = clock_timestamp(), end_reason = p_end_reason WHERE id = p_turn_id;
  END IF;
  PERFORM public.publish_workshop_state(p_session_id, 'sayLess', v_next.phase);
  RETURN true;
END;
$$;

-- Read-only deployment check: no fabricated session/action is needed to probe RPCs.
CREATE OR REPLACE FUNCTION public.workshop_transaction_schema_ready()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT to_regprocedure('public.commit_code_switch_transition(uuid,uuid,text,text,jsonb,jsonb,integer,jsonb)') IS NOT NULL
    AND to_regprocedure('public.publish_workshop_state(uuid,text,text,jsonb)') IS NOT NULL
    AND to_regprocedure('public.lock_code_switch_clue(uuid,uuid,uuid,text,text)') IS NOT NULL
    AND to_regprocedure('public.commit_say_less_turn(uuid,integer,uuid,jsonb,jsonb,text)') IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.publish_workshop_state(uuid,text,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_code_switch_transition(uuid,uuid,text,text,jsonb,jsonb,integer,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lock_code_switch_clue(uuid,uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_say_less_turn(uuid,integer,uuid,jsonb,jsonb,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.workshop_transaction_schema_ready() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_workshop_state(uuid,text,text,jsonb),
  public.commit_code_switch_transition(uuid,uuid,text,text,jsonb,jsonb,integer,jsonb),
  public.lock_code_switch_clue(uuid,uuid,uuid,text,text),
  public.commit_say_less_turn(uuid,integer,uuid,jsonb,jsonb,text),
  public.workshop_transaction_schema_ready() TO service_role;
COMMIT;
