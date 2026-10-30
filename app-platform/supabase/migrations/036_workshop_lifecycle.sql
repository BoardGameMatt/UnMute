-- R3/R5: lifecycle ownership and preparation commit in one transaction.
-- Game decisions remain in TypeScript; SQL owns locks, versions and persistence.
BEGIN;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS lifecycle_version integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.lock_active_workshop(p_session_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_status text;
BEGIN
  SELECT status INTO v_status FROM public.sessions WHERE id=p_session_id FOR UPDATE;
  RETURN FOUND AND v_status='active';
END; $$;

CREATE OR REPLACE FUNCTION public.start_workshop_session(
  p_session_id uuid, p_protocol text, p_expected_version integer, p_init jsonb
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_session public.sessions%ROWTYPE; v_round uuid; v_sl public.say_less_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM public.sessions WHERE id=p_session_id FOR UPDATE;
  IF NOT FOUND OR v_session.status <> 'lobby' OR v_session.lifecycle_version IS DISTINCT FROM p_expected_version
    THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.protocols WHERE id=v_session.protocol_id AND slug=p_protocol)
    THEN RAISE EXCEPTION 'Protocol does not match session'; END IF;
  IF p_protocol='code-switch' THEN
    UPDATE public.code_switch_sessions SET current_round_id=NULL WHERE session_id=p_session_id;
    DELETE FROM public.code_switch_rounds WHERE session_id=p_session_id;
    DELETE FROM public.code_switch_sessions WHERE session_id=p_session_id;
    INSERT INTO public.code_switch_sessions(session_id,phase) VALUES(p_session_id,'write');
    INSERT INTO public.code_switch_rounds(session_id,round_index,guesser_id,word_id,round_type,write_started_at)
      VALUES(p_session_id,1,(p_init->>'guesserId')::uuid,(p_init->>'wordId')::uuid,p_init->>'roundType',clock_timestamp()) RETURNING id INTO v_round;
    UPDATE public.code_switch_sessions SET current_round_id=v_round WHERE session_id=p_session_id;
    UPDATE public.session_state SET state_json='{}',current_round=0 WHERE session_id=p_session_id;
    PERFORM public.publish_workshop_state(p_session_id,'codeSwitch','write');
  ELSIF p_protocol='say-less' THEN
    SELECT * INTO v_sl FROM public.say_less_sessions WHERE session_id=p_session_id FOR UPDATE;
    IF NOT FOUND OR v_sl.version IS DISTINCT FROM (p_init->>'version')::integer OR v_sl.phase <> 'lobby'
      THEN RETURN false; END IF;
    DELETE FROM public.say_less_turns WHERE session_id=p_session_id;
    DELETE FROM public.say_less_previews WHERE session_id=p_session_id;
    DELETE FROM public.say_less_teams WHERE session_id=p_session_id;
    INSERT INTO public.say_less_teams(session_id,label,member_ids) VALUES
      (p_session_id,'A',ARRAY(SELECT jsonb_array_elements_text(p_init->'teamA')::uuid)),
      (p_session_id,'B',ARRAY(SELECT jsonb_array_elements_text(p_init->'teamB')::uuid));
    UPDATE public.say_less_sessions SET phase='teams',
      deck_card_ids=ARRAY(SELECT jsonb_array_elements_text(p_init->'deck')::uuid),
      pile_card_ids=ARRAY(SELECT jsonb_array_elements_text(p_init->'deck')::uuid), round=1,
      first_team=p_init->>'firstTeam', next_team=p_init->>'firstTeam', cursor_a=0,cursor_b=0,
      current_turn_id=NULL,phase_deadline=NULL,hold_started_at=NULL,paused=false,
      last_turn_got_it=NULL,last_turn_end_reason=NULL,round_1_ended_early=false,round_2_ended_early=false,
      version=version+1 WHERE session_id=p_session_id;
    UPDATE public.session_state SET state_json='{}',current_round=0 WHERE session_id=p_session_id;
    PERFORM public.publish_workshop_state(p_session_id,'sayLess','teams');
  ELSIF p_protocol IN ('draw-it-by-ear','wrong-answers-only') THEN
    UPDATE public.session_state SET state_json='{}',phase='waiting',current_round=0,updated_at=clock_timestamp()
      WHERE session_id=p_session_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Shared session state missing'; END IF;
  ELSE RAISE EXCEPTION 'Unsupported atomic lifecycle protocol'; END IF;
  UPDATE public.sessions SET status='active',started_at=clock_timestamp(),completed_at=NULL,
    lifecycle_version=lifecycle_version+1 WHERE id=p_session_id;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.reset_workshop_session(p_session_id uuid,p_expected_version integer)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_session public.sessions%ROWTYPE; v_slug text;
BEGIN
  SELECT * INTO v_session FROM public.sessions WHERE id=p_session_id FOR UPDATE;
  IF NOT FOUND OR v_session.lifecycle_version IS DISTINCT FROM p_expected_version OR v_session.status='cancelled'
    THEN RETURN false; END IF;
  IF v_session.status='lobby' THEN RETURN true; END IF;
  SELECT slug INTO v_slug FROM public.protocols WHERE id=v_session.protocol_id;
  IF v_slug='code-switch' THEN
    PERFORM 1 FROM public.code_switch_sessions WHERE session_id=p_session_id FOR UPDATE;
    UPDATE public.code_switch_sessions SET current_round_id=NULL WHERE session_id=p_session_id;
    DELETE FROM public.code_switch_rounds WHERE session_id=p_session_id;
    DELETE FROM public.code_switch_sessions WHERE session_id=p_session_id;
  ELSIF v_slug='say-less' THEN
    PERFORM 1 FROM public.say_less_sessions WHERE session_id=p_session_id FOR UPDATE;
    -- Break the live-turn FK before deleting its target.
    UPDATE public.say_less_sessions SET current_turn_id=NULL WHERE session_id=p_session_id;
    DELETE FROM public.say_less_turns WHERE session_id=p_session_id;
    DELETE FROM public.say_less_previews WHERE session_id=p_session_id;
    DELETE FROM public.say_less_teams WHERE session_id=p_session_id;
    UPDATE public.say_less_sessions SET phase='lobby',deck_card_ids='{}',pile_card_ids='{}',round=1,
      first_team='A',next_team='A',cursor_a=0,cursor_b=0,phase_deadline=NULL,hold_started_at=NULL,
      paused=false,last_turn_got_it=NULL,last_turn_end_reason=NULL,round_1_ended_early=false,
      round_2_ended_early=false,version=version+1 WHERE session_id=p_session_id;
  ELSIF v_slug NOT IN ('draw-it-by-ear','wrong-answers-only') THEN
    RAISE EXCEPTION 'Unsupported atomic lifecycle protocol';
  END IF;
  UPDATE public.session_state SET state_json='{}',phase='waiting',current_round=0,updated_at=clock_timestamp()
    WHERE session_id=p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shared session state missing'; END IF;
  UPDATE public.sessions SET status='lobby',started_at=NULL,completed_at=NULL,
    lifecycle_version=lifecycle_version+1 WHERE id=p_session_id;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.commit_say_less_setup(
  p_session_id uuid,p_expected_version integer,p_expected_phase text,p_patch jsonb,
  p_teams jsonb DEFAULT NULL,p_previews jsonb DEFAULT NULL,p_turn jsonb DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_row public.say_less_sessions%ROWTYPE; v_next public.say_less_sessions%ROWTYPE; v_team jsonb; v_turn uuid; v_status text;
BEGIN
  SELECT status INTO v_status FROM public.sessions WHERE id=p_session_id FOR UPDATE;
  IF NOT FOUND OR (p_expected_phase='lobby' AND v_status <> 'lobby')
    OR (p_expected_phase <> 'lobby' AND v_status <> 'active') THEN RETURN false; END IF;
  SELECT * INTO v_row FROM public.say_less_sessions WHERE session_id=p_session_id FOR UPDATE;
  IF NOT FOUND OR v_row.version IS DISTINCT FROM p_expected_version OR v_row.phase IS DISTINCT FROM p_expected_phase
    THEN RETURN false; END IF;
  IF jsonb_typeof(p_patch) <> 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN
    ('phase','round','pile_card_ids','next_team','cursor_a','cursor_b','phase_deadline','hold_started_at','paused','last_turn_got_it','last_turn_end_reason','category_a','category_b'))
    THEN RAISE EXCEPTION 'Invalid setup patch'; END IF;
  IF p_teams IS NOT NULL THEN
    FOR v_team IN SELECT * FROM jsonb_array_elements(p_teams) LOOP
      UPDATE public.say_less_teams SET member_ids=ARRAY(SELECT jsonb_array_elements_text(v_team->'memberIds')::uuid)
        WHERE id=(v_team->>'id')::uuid AND session_id=p_session_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Team does not belong to session'; END IF;
    END LOOP;
  END IF;
  IF p_previews IS NOT NULL THEN
    DELETE FROM public.say_less_previews WHERE session_id=p_session_id;
    INSERT INTO public.say_less_previews(session_id,participant_id,card_ids)
      SELECT p_session_id,(v->>'participantId')::uuid,ARRAY(SELECT jsonb_array_elements_text(v->'cardIds')::uuid)
      FROM jsonb_array_elements(p_previews) v;
  END IF;
  v_next := jsonb_populate_record(v_row,p_patch);
  IF p_turn IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM public.say_less_teams WHERE id=(p_turn->>'teamId')::uuid AND session_id=p_session_id)
      THEN RAISE EXCEPTION 'Turn team does not belong to session'; END IF;
    INSERT INTO public.say_less_turns(session_id,round,team_id,clue_giver_id,started_at)
      VALUES(p_session_id,v_next.round,(p_turn->>'teamId')::uuid,(p_turn->>'giverId')::uuid,(p_turn->>'startedAt')::timestamptz)
      RETURNING id INTO v_turn;
    v_next.current_turn_id := v_turn;
  END IF;
  UPDATE public.say_less_sessions SET phase=v_next.phase,round=v_next.round,pile_card_ids=v_next.pile_card_ids,
    category_a=v_next.category_a,category_b=v_next.category_b,
    next_team=v_next.next_team,cursor_a=v_next.cursor_a,cursor_b=v_next.cursor_b,current_turn_id=v_next.current_turn_id,
    phase_deadline=v_next.phase_deadline,hold_started_at=v_next.hold_started_at,paused=v_next.paused,
    last_turn_got_it=v_next.last_turn_got_it,last_turn_end_reason=v_next.last_turn_end_reason,version=version+1
    WHERE session_id=p_session_id;
  PERFORM public.publish_workshop_state(p_session_id,'sayLess',v_next.phase);
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.commit_code_switch_transition(
  p_session_id uuid, p_round_id uuid, p_expected_phase text, p_next_phase text,
  p_round_patch jsonb, p_clues jsonb, p_score_delta integer,
  p_extra jsonb DEFAULT '{}'::jsonb
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_session public.code_switch_sessions%ROWTYPE;
  v_round public.code_switch_rounds%ROWTYPE;
BEGIN
  IF NOT public.lock_active_workshop(p_session_id) THEN RETURN false; END IF;
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
  IF NOT public.lock_active_workshop(p_session_id) THEN RETURN false; END IF;
  SELECT * INTO v_session FROM public.code_switch_sessions WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND OR v_session.phase <> 'write' OR v_session.current_round_id IS DISTINCT FROM p_round_id THEN RETURN false; END IF;
  INSERT INTO public.code_switch_clues(round_id, participant_id, raw_text, normalized)
  VALUES (p_round_id, p_participant_id, p_raw_text, p_normalized)
  ON CONFLICT (round_id, participant_id) DO NOTHING;
  IF NOT FOUND THEN
    -- A conflicting second clue must not be acknowledged as the accepted input.
    RETURN EXISTS (SELECT 1 FROM public.code_switch_clues
      WHERE round_id = p_round_id AND participant_id = p_participant_id
        AND raw_text = p_raw_text AND normalized = p_normalized);
  END IF;
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
  v_receipt public.say_less_card_events%ROWTYPE;
BEGIN
  IF NOT public.lock_active_workshop(p_session_id) THEN RETURN false; END IF;
  SELECT * INTO v_session FROM public.say_less_sessions WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF p_event->>'operationId' IS NOT NULL THEN
    SELECT * INTO v_receipt FROM public.say_less_card_events WHERE operation_id = (p_event->>'operationId')::uuid;
    IF FOUND THEN
      IF NOT EXISTS (SELECT 1 FROM public.say_less_turns WHERE id = v_receipt.turn_id AND session_id = p_session_id)
        OR v_receipt.turn_id IS DISTINCT FROM p_turn_id
        OR v_receipt.card_id IS DISTINCT FROM (p_event->>'cardId')::uuid
        OR v_receipt.outcome IS DISTINCT FROM p_event->>'outcome'
        OR v_receipt.operation_version IS DISTINCT FROM p_expected_version THEN
        RAISE EXCEPTION 'Operation ID conflicts with an accepted input';
      END IF;
      RETURN true;
    END IF;
    IF (p_event->>'expectedVersion')::integer IS DISTINCT FROM p_expected_version THEN
      RAISE EXCEPTION 'Operation version does not match';
    END IF;
  END IF;
  IF v_session.version IS DISTINCT FROM p_expected_version
    OR v_session.current_turn_id IS DISTINCT FROM p_turn_id THEN RETURN false; END IF;
  -- A recovered input can wait for this row lock across the deadline. Accepted
  -- receipts above remain replayable; a new scoring/pass event must still be on time.
  IF p_event->>'outcome' IN ('got_it', 'pass') AND v_session.phase_deadline IS NOT NULL
    AND clock_timestamp() >= v_session.phase_deadline THEN RETURN false; END IF;
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
    INSERT INTO public.say_less_card_events(turn_id, card_id, outcome, operation_id, operation_version)
    VALUES (p_turn_id, (p_event->>'cardId')::uuid, p_event->>'outcome',
      (p_event->>'operationId')::uuid,
      CASE WHEN p_event->>'operationId' IS NOT NULL THEN p_expected_version ELSE NULL END);
  END IF;
  IF p_end_reason IS NOT NULL THEN
    UPDATE public.say_less_turns SET ended_at = clock_timestamp(), end_reason = p_end_reason WHERE id = p_turn_id;
  END IF;
  PERFORM public.publish_workshop_state(p_session_id, 'sayLess', v_next.phase);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_code_switch_round(p_session_id uuid,p_expected_round_id uuid,p_round jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_cs public.code_switch_sessions%ROWTYPE; v_id uuid;
BEGIN
  IF NOT public.lock_active_workshop(p_session_id) THEN RETURN false; END IF;
  SELECT * INTO v_cs FROM public.code_switch_sessions WHERE session_id=p_session_id FOR UPDATE;
  IF NOT FOUND OR v_cs.phase <> 'reveal' OR v_cs.current_round_id IS DISTINCT FROM p_expected_round_id THEN RETURN false; END IF;
  INSERT INTO public.code_switch_rounds(session_id,round_index,guesser_id,word_id,round_type,write_started_at)
    VALUES(p_session_id,(p_round->>'index')::integer,(p_round->>'guesserId')::uuid,(p_round->>'wordId')::uuid,p_round->>'roundType',clock_timestamp())
    RETURNING id INTO v_id;
  UPDATE public.code_switch_sessions SET phase='write',current_round_id=v_id WHERE session_id=p_session_id;
  PERFORM public.publish_workshop_state(p_session_id,'codeSwitch','write');
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.finish_code_switch_phase(p_session_id uuid,p_expected_round_id uuid,p_complete boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_cs public.code_switch_sessions%ROWTYPE;
BEGIN
  IF NOT public.lock_active_workshop(p_session_id) THEN RETURN false; END IF;
  SELECT * INTO v_cs FROM public.code_switch_sessions WHERE session_id=p_session_id FOR UPDATE;
  IF NOT FOUND OR v_cs.current_round_id IS DISTINCT FROM p_expected_round_id
    OR v_cs.phase IS DISTINCT FROM (CASE WHEN p_complete THEN 'scoreboard' ELSE 'reveal' END) THEN RETURN false; END IF;
  IF p_complete THEN
    UPDATE public.sessions SET status='completed',completed_at=clock_timestamp() WHERE id=p_session_id;
  ELSE UPDATE public.code_switch_sessions SET phase='scoreboard' WHERE session_id=p_session_id; END IF;
  PERFORM public.publish_workshop_state(p_session_id,'codeSwitch','scoreboard',
    CASE WHEN p_complete THEN '{"recapAdvanced":true}'::jsonb ELSE '{}'::jsonb END);
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.complete_say_less_session(p_session_id uuid,p_expected_version integer)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NOT public.lock_active_workshop(p_session_id) THEN RETURN false; END IF;
  PERFORM 1 FROM public.say_less_sessions WHERE session_id=p_session_id AND phase='final_scores' AND version=p_expected_version FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.sessions SET status='completed',completed_at=clock_timestamp() WHERE id=p_session_id;
  PERFORM public.publish_workshop_state(p_session_id,'sayLess','final_scores');
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.start_code_switch_round(uuid,uuid,jsonb),public.finish_code_switch_phase(uuid,uuid,boolean),
  public.complete_say_less_session(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.start_code_switch_round(uuid,uuid,jsonb),public.finish_code_switch_phase(uuid,uuid,boolean),
  public.complete_say_less_session(uuid,integer) TO service_role;

REVOKE ALL ON FUNCTION public.lock_active_workshop(uuid),
  public.start_workshop_session(uuid,text,integer,jsonb),public.reset_workshop_session(uuid,integer),
  public.commit_say_less_setup(uuid,integer,text,jsonb,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lock_active_workshop(uuid),
  public.start_workshop_session(uuid,text,integer,jsonb),public.reset_workshop_session(uuid,integer),
  public.commit_say_less_setup(uuid,integer,text,jsonb,jsonb,jsonb,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.workshop_session_reliability_schema_ready()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT public.workshop_browser_recovery_schema_ready()
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='session_state' AND column_name='revision' AND data_type='bigint')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sessions' AND column_name='lifecycle_version' AND data_type='integer')
    AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.session_state') AND tgname='session_snapshot_revision' AND tgenabled IN ('O','A'))
    AND to_regprocedure('public.start_workshop_session(uuid,text,integer,jsonb)') IS NOT NULL
    AND to_regprocedure('public.reset_workshop_session(uuid,integer)') IS NOT NULL
    AND to_regprocedure('public.commit_say_less_setup(uuid,integer,text,jsonb,jsonb,jsonb,jsonb)') IS NOT NULL
    AND to_regprocedure('public.start_code_switch_round(uuid,uuid,jsonb)') IS NOT NULL
    AND to_regprocedure('public.finish_code_switch_phase(uuid,uuid,boolean)') IS NOT NULL
    AND to_regprocedure('public.complete_say_less_session(uuid,integer)') IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.workshop_session_reliability_schema_ready() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.workshop_session_reliability_schema_ready() TO service_role;
COMMIT;
