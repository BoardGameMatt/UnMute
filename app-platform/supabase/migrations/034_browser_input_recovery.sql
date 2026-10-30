-- R1/R6: stable Say Less card receipts, committed with the score/pile update.
-- Apply after 033 and before deploying clients that persist/retry pending input.
BEGIN;
ALTER TABLE public.say_less_card_events ADD COLUMN IF NOT EXISTS operation_id uuid;
ALTER TABLE public.say_less_card_events ADD COLUMN IF NOT EXISTS operation_version integer;
CREATE UNIQUE INDEX IF NOT EXISTS say_less_card_operation_once
  ON public.say_less_card_events(operation_id) WHERE operation_id IS NOT NULL;

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

-- CREATE OR REPLACE retains the existing service-role-only privileges.
CREATE OR REPLACE FUNCTION public.workshop_browser_recovery_schema_ready()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT public.workshop_transaction_schema_ready()
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
      AND table_name = 'say_less_card_events' AND column_name = 'operation_id' AND data_type = 'uuid')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
      AND table_name = 'say_less_card_events' AND column_name = 'operation_version' AND data_type = 'integer')
    AND EXISTS (SELECT 1 FROM pg_index WHERE indexrelid = to_regclass('public.say_less_card_operation_once') AND indisunique);
$$;
REVOKE ALL ON FUNCTION public.workshop_browser_recovery_schema_ready() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workshop_browser_recovery_schema_ready() TO service_role;
COMMIT;
