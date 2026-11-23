BEGIN;
-- DIBE's related relational state must follow its CAS snapshot in the same write.
CREATE OR REPLACE FUNCTION public.sync_dibe_snapshot() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_status text; v_slug text;
BEGIN
 SELECT s.status,p.slug INTO v_status,v_slug FROM sessions s JOIN protocols p ON p.id=s.protocol_id
 WHERE s.id=NEW.session_id FOR UPDATE OF s;
 IF v_slug<>'draw-it-by-ear' THEN RETURN NEW; END IF;
 IF NEW.state_json='{}'::jsonb THEN DELETE FROM dibe_teams WHERE session_id=NEW.session_id; RETURN NEW; END IF;
 IF v_status<>'active' THEN RAISE EXCEPTION 'Workshop changed before the drawing action' USING ERRCODE='40001'; END IF;
 IF NEW.state_json->'scoring_admission' IS DISTINCT FROM OLD.state_json->'scoring_admission' THEN
  IF NEW.state_json#>>'{scoring_admission,phase}' IS DISTINCT FROM OLD.state_json->>'phase'
   OR NEW.state_json#>>'{scoring_admission,timer}' IS DISTINCT FROM OLD.state_json->>'timer_started_at'
   OR (OLD.state_json->>'timer_started_at' IS NOT NULL AND (OLD.state_json->>'timer_duration_seconds')::integer>0
    AND clock_timestamp()>=(OLD.state_json->>'timer_started_at')::timestamptz+make_interval(secs=>(OLD.state_json->>'timer_duration_seconds')::integer))
  THEN RAISE EXCEPTION 'Scoring window ended before commit' USING ERRCODE='40001'; END IF;
 END IF;
 IF NEW.state_json->'teams' IS DISTINCT FROM OLD.state_json->'teams' AND COALESCE((NEW.state_json->>'teams_locked')::boolean,false) THEN
  DELETE FROM dibe_teams WHERE session_id=NEW.session_id AND name NOT IN (SELECT value->>'name' FROM jsonb_array_elements(NEW.state_json->'teams'));
  UPDATE dibe_teams d SET color=t.color,member_ids=t.member_ids,describer_rotation=t.describer_rotation,
   current_describer_index=t.current_describer_index,cumulative_score=t.cumulative_score
  FROM jsonb_to_recordset(NEW.state_json->'teams') t(name text,color text,member_ids uuid[],describer_rotation uuid[],current_describer_index integer,cumulative_score integer)
  WHERE d.session_id=NEW.session_id AND d.name=t.name;
  INSERT INTO dibe_teams(session_id,name,color,member_ids,describer_rotation,current_describer_index,cumulative_score)
  SELECT NEW.session_id,t.name,t.color,t.member_ids,t.describer_rotation,t.current_describer_index,t.cumulative_score
  FROM jsonb_to_recordset(NEW.state_json->'teams') t(name text,color text,member_ids uuid[],describer_rotation uuid[],current_describer_index integer,cumulative_score integer)
  WHERE NOT EXISTS(SELECT 1 FROM dibe_teams d WHERE d.session_id=NEW.session_id AND d.name=t.name);
 END IF;
 IF COALESCE((NEW.state_json->>'completion_requested')::boolean,false) THEN
  UPDATE sessions SET status='completed',completed_at=clock_timestamp() WHERE id=NEW.session_id;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS dibe_snapshot_side_effects ON public.session_state;
CREATE TRIGGER dibe_snapshot_side_effects AFTER UPDATE OF state_json ON public.session_state
FOR EACH ROW EXECUTE FUNCTION public.sync_dibe_snapshot();

CREATE OR REPLACE FUNCTION public.lookup_workshop_receipt(p_session_id uuid,p_generation integer,p_actor_id uuid,p_operation_id uuid,p_payload jsonb)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE v_receipt public.workshop_action_receipts;
BEGIN
 SELECT * INTO v_receipt FROM workshop_action_receipts WHERE session_id=p_session_id AND generation=p_generation AND operation_id=p_operation_id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF v_receipt.actor_id IS DISTINCT FROM p_actor_id OR v_receipt.payload IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'Operation ID reused for different input' USING ERRCODE='40001'; END IF;
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.commit_dibe_snapshot(p_session_id uuid,p_generation integer,p_revision bigint,p_actor_id uuid,p_operation_id uuid,p_payload jsonb,p_state jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_root public.sessions; v_count integer;
BEGIN
 SELECT * INTO v_root FROM sessions WHERE id=p_session_id FOR UPDATE;
 IF NOT FOUND OR v_root.status<>'active' OR v_root.lifecycle_version IS DISTINCT FROM p_generation THEN RAISE EXCEPTION 'Workshop changed' USING ERRCODE='40001'; END IF;
 IF NOT EXISTS(SELECT 1 FROM protocols WHERE id=v_root.protocol_id AND slug='draw-it-by-ear') OR NOT EXISTS(SELECT 1 FROM session_participants WHERE session_id=p_session_id AND participant_id=p_actor_id) THEN RAISE EXCEPTION 'Not a member of this drawing session' USING ERRCODE='42501'; END IF;
 IF public.lookup_workshop_receipt(p_session_id,p_generation,p_actor_id,p_operation_id,p_payload) THEN RETURN jsonb_build_object('deduped',true); END IF;
 UPDATE session_state SET state_json=p_state,phase=p_state->>'phase',current_round=(p_state->>'total_rounds_played')::integer,updated_at=clock_timestamp()
 WHERE session_id=p_session_id AND revision=p_revision;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count=0 THEN RETURN jsonb_build_object('conflict',true); END IF;
 INSERT INTO workshop_action_receipts(session_id,generation,operation_id,actor_id,payload) VALUES(p_session_id,p_generation,p_operation_id,p_actor_id,p_payload);
 RETURN jsonb_build_object('deduped',false);
END $$;
REVOKE ALL ON FUNCTION public.lookup_workshop_receipt(uuid,integer,uuid,uuid,jsonb),public.commit_dibe_snapshot(uuid,integer,bigint,uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_workshop_receipt(uuid,integer,uuid,uuid,jsonb),public.commit_dibe_snapshot(uuid,integer,bigint,uuid,uuid,jsonb,jsonb) TO service_role;

-- Tap admission and round closure now use the same durable locks and DB clock.
ALTER TABLE public.wao_taps ADD COLUMN IF NOT EXISTS operation_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS wao_tap_operation_unique ON public.wao_taps(pair_id,participant_id,operation_id) WHERE operation_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.admit_wao_tap() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_round public.wao_rounds; v_root uuid; v_timer integer; v_status text;
BEGIN
 SELECT s.session_id INTO v_root FROM wao_pairs p JOIN wao_rounds r ON r.id=p.round_id JOIN wao_sessions s ON s.id=r.wao_session_id WHERE p.id=NEW.pair_id;
 SELECT status INTO v_status FROM sessions WHERE id=v_root FOR UPDATE;
 SELECT r.* INTO v_round FROM wao_rounds r JOIN wao_pairs p ON p.round_id=r.id WHERE p.id=NEW.pair_id FOR UPDATE OF r;
 SELECT timer_seconds INTO v_timer FROM wao_sessions WHERE id=v_round.wao_session_id;
 IF v_status IS DISTINCT FROM 'active' OR v_round.locked_at IS NOT NULL OR v_round.started_at IS NULL
  OR clock_timestamp()>=v_round.started_at+make_interval(secs=>v_timer+3) THEN RAISE EXCEPTION 'Round input window has ended' USING ERRCODE='40001'; END IF;
 IF NOT EXISTS(SELECT 1 FROM wao_question_items WHERE id=NEW.item_id AND question_id=v_round.question_id) THEN RAISE EXCEPTION 'Item is not in this question'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS wao_tap_admission ON public.wao_taps;
CREATE TRIGGER wao_tap_admission BEFORE INSERT ON public.wao_taps FOR EACH ROW EXECUTE FUNCTION public.admit_wao_tap();

CREATE OR REPLACE FUNCTION public.record_wao_tap(p_pair_id uuid,p_actor_id uuid,p_item_id uuid,p_action text,p_client_seq integer,p_operation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_root uuid; v_pair public.wao_pairs; v_tap public.wao_taps; v_seq integer;
BEGIN
 SELECT p.* INTO v_pair FROM wao_pairs p WHERE p.id=p_pair_id;
 IF NOT FOUND OR p_actor_id IS DISTINCT FROM v_pair.participant_a AND p_actor_id IS DISTINCT FROM v_pair.participant_b THEN RAISE EXCEPTION 'Pair changed' USING ERRCODE='40001'; END IF;
 SELECT s.session_id INTO v_root FROM wao_rounds r JOIN wao_sessions s ON s.id=r.wao_session_id WHERE r.id=v_pair.round_id;
 PERFORM 1 FROM sessions WHERE id=v_root AND status='active' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Workshop changed' USING ERRCODE='40001'; END IF;
 PERFORM 1 FROM wao_rounds WHERE id=v_pair.round_id FOR UPDATE;
 SELECT * INTO v_tap FROM wao_taps WHERE pair_id=p_pair_id AND participant_id=p_actor_id AND operation_id=p_operation_id;
 IF FOUND THEN
  IF v_tap.item_id IS DISTINCT FROM p_item_id OR v_tap.action IS DISTINCT FROM p_action THEN RAISE EXCEPTION 'Operation ID reused for a different tap' USING ERRCODE='40001'; END IF;
  RETURN jsonb_build_object('tap',to_jsonb(v_tap),'deduped',true);
 END IF;
 SELECT COALESCE(max(client_seq),0)+1 INTO v_seq FROM wao_taps WHERE pair_id=p_pair_id AND participant_id=p_actor_id;
 INSERT INTO wao_taps(pair_id,participant_id,item_id,action,client_seq,operation_id)
 VALUES(p_pair_id,p_actor_id,p_item_id,p_action,v_seq,p_operation_id) RETURNING * INTO v_tap;
 RETURN jsonb_build_object('tap',to_jsonb(v_tap),'deduped',false);
END $$;
REVOKE ALL ON FUNCTION public.record_wao_tap(uuid,uuid,uuid,text,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_wao_tap(uuid,uuid,uuid,text,integer,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.guard_wao_lifecycle() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF NEW.status IS NOT DISTINCT FROM OLD.status OR NOT EXISTS(SELECT 1 FROM protocols WHERE id=NEW.protocol_id AND slug='wrong-answers-only') THEN RETURN NEW; END IF;
 IF NEW.status='completed' AND EXISTS(SELECT 1 FROM wao_rounds r JOIN wao_sessions s ON s.id=r.wao_session_id WHERE s.session_id=NEW.id AND r.locked_at IS NULL) THEN RAISE EXCEPTION 'A round is still in progress' USING ERRCODE='40001'; END IF;
 IF NEW.status='lobby' THEN DELETE FROM wao_sessions WHERE session_id=NEW.id; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS wao_session_lifecycle ON public.sessions;
CREATE TRIGGER wao_session_lifecycle BEFORE UPDATE OF status ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.guard_wao_lifecycle();

CREATE OR REPLACE FUNCTION public.workshop_remaining_reliability_schema_ready()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT public.workshop_session_reliability_schema_ready()
 AND to_regclass('public.workshop_action_receipts') IS NOT NULL
 AND to_regprocedure('public.load_workshop_transaction(uuid)') IS NOT NULL
 AND to_regprocedure('public.prepare_workshop_rows(uuid,text,jsonb)') IS NOT NULL
 AND to_regprocedure('public.commit_workshop_transaction(uuid,jsonb,jsonb,timestamp with time zone)') IS NOT NULL
 AND to_regprocedure('public.lookup_workshop_receipt(uuid,integer,uuid,uuid,jsonb)') IS NOT NULL
 AND to_regprocedure('public.commit_dibe_snapshot(uuid,integer,bigint,uuid,uuid,jsonb,jsonb)') IS NOT NULL
 AND to_regprocedure('public.record_wao_tap(uuid,uuid,uuid,text,integer,uuid)') IS NOT NULL
 AND EXISTS(SELECT 1 FROM pg_index WHERE indexrelid=to_regclass('public.wao_tap_operation_unique') AND indisunique AND indisvalid)
 AND EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.session_state') AND tgname='dibe_snapshot_side_effects' AND tgenabled IN ('O','A'))
 AND EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.wao_taps') AND tgname='wao_tap_admission' AND tgenabled IN ('O','A'))
 AND EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.sessions') AND tgname='wao_session_lifecycle' AND tgenabled IN ('O','A'));
$$;
REVOKE ALL ON FUNCTION public.workshop_remaining_reliability_schema_ready() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.workshop_remaining_reliability_schema_ready() TO service_role;
COMMIT;
