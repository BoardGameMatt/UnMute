BEGIN;
-- Server-only unit-of-work boundary for the remaining tabular coordinators.
-- TypeScript still makes game decisions. PostgreSQL owns atomicity and CAS.
CREATE TABLE IF NOT EXISTS public.workshop_action_receipts (
 session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
 generation integer NOT NULL,
 operation_id uuid NOT NULL,
 actor_id uuid NOT NULL REFERENCES public.participants(id),
 payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(session_id,generation,operation_id)
);
ALTER TABLE public.workshop_action_receipts ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.workshop_action_receipts TO service_role;
CREATE OR REPLACE FUNCTION public.workshop_transaction_tables(p_session_id uuid)
RETURNS text[] LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT ARRAY['sessions','session_state','session_participants','participants','workshop_action_receipts'] ||
 CASE p.slug
 WHEN 'talk-track' THEN ARRAY['talk_track_sessions','talk_track_teams','talk_track_turns','talk_track_word_results','talk_track_score_nudges']
 WHEN 'zoning-rights' THEN ARRAY['zoning_rights_sessions','zoning_rights_rounds','zoning_rights_guesses']
 WHEN 'i-know-what-you-meme' THEN ARRAY['ikwym_sessions','ikwym_responses','ikwym_reveal_items','ikwym_guesses']
 WHEN 'rank-and-file' THEN ARRAY['rank_and_file_sessions','rank_and_file_rounds','rank_and_file_deals']
 WHEN 'the-truth-is' THEN ARRAY['truth_is_sessions','truth_is_entries']
 WHEN 'airtime' THEN ARRAY['airtime_sessions','airtime_boats','airtime_boat_members','airtime_dives','airtime_boat_dives','airtime_diver_dives','airtime_choices','airtime_events']
 WHEN 'on-the-same-page' THEN ARRAY['otsp_sessions','otsp_rounds','otsp_events','otsp_rotation_debt']
 WHEN 'cover-story' THEN ARRAY['cover_story_sessions','cover_story_deals','cover_story_word_logs','cover_story_guesses','cover_story_target_results']
 WHEN 'wrong-answers-only' THEN ARRAY['wao_sessions','wao_rounds','wao_pairs','wao_taps','wao_round_results']
 ELSE ARRAY[]::text[] END
 FROM sessions s JOIN protocols p ON p.id=s.protocol_id WHERE s.id=p_session_id
$$;

CREATE OR REPLACE FUNCTION public.workshop_transaction_rows(p_session_id uuid,p_table text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE v_where text; v_rows jsonb;
BEGIN
 IF NOT (p_table=ANY(public.workshop_transaction_tables(p_session_id))) THEN RAISE EXCEPTION 'Undeclared workshop table %',p_table; END IF;
 v_where := CASE p_table
 WHEN 'sessions' THEN 'team_id=(SELECT team_id FROM public.sessions WHERE id=$1)'
 WHEN 'participants' THEN 'team_id=(SELECT team_id FROM public.sessions WHERE id=$1)'
 WHEN 'otsp_rotation_debt' THEN 'team_id=(SELECT team_id FROM public.sessions WHERE id=$1)'
 WHEN 'otsp_rounds' THEN 'session_id IN (SELECT id FROM public.sessions WHERE team_id=(SELECT team_id FROM public.sessions WHERE id=$1))'
 WHEN 'workshop_action_receipts' THEN 'session_id=$1 AND generation=(SELECT lifecycle_version FROM public.sessions WHERE id=$1)'
 WHEN 'wao_rounds' THEN 'wao_session_id IN (SELECT id FROM public.wao_sessions WHERE session_id=$1)'
 WHEN 'wao_pairs' THEN 'round_id IN (SELECT r.id FROM public.wao_rounds r JOIN public.wao_sessions s ON s.id=r.wao_session_id WHERE s.session_id=$1)'
 WHEN 'wao_taps' THEN 'pair_id IN (SELECT p.id FROM public.wao_pairs p JOIN public.wao_rounds r ON r.id=p.round_id JOIN public.wao_sessions s ON s.id=r.wao_session_id WHERE s.session_id=$1)'
 WHEN 'wao_round_results' THEN 'pair_id IN (SELECT p.id FROM public.wao_pairs p JOIN public.wao_rounds r ON r.id=p.round_id JOIN public.wao_sessions s ON s.id=r.wao_session_id WHERE s.session_id=$1)'
 WHEN 'talk_track_word_results' THEN 'turn_id IN (SELECT id FROM public.talk_track_turns WHERE session_id=$1)'
 WHEN 'zoning_rights_guesses' THEN 'round_id IN (SELECT id FROM public.zoning_rights_rounds WHERE session_id=$1)'
 WHEN 'rank_and_file_deals' THEN 'round_id IN (SELECT id FROM public.rank_and_file_rounds WHERE session_id=$1)'
 WHEN 'ikwym_guesses' THEN 'reveal_item_id IN (SELECT id FROM public.ikwym_reveal_items WHERE session_id=$1)'
 WHEN 'cover_story_deals' THEN 'cover_story_session_id IN (SELECT id FROM public.cover_story_sessions WHERE session_id=$1)'
 WHEN 'cover_story_guesses' THEN 'cover_story_session_id IN (SELECT id FROM public.cover_story_sessions WHERE session_id=$1)'
 WHEN 'cover_story_target_results' THEN 'cover_story_session_id IN (SELECT id FROM public.cover_story_sessions WHERE session_id=$1)'
 WHEN 'cover_story_word_logs' THEN 'deal_id IN (SELECT id FROM public.cover_story_deals WHERE cover_story_session_id IN (SELECT id FROM public.cover_story_sessions WHERE session_id=$1))'
 ELSE 'session_id=$1' END;
 EXECUTE format('SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),''[]''::jsonb) FROM public.%I t WHERE %s',p_table,v_where) INTO v_rows USING p_session_id;
 RETURN v_rows;
END $$;

CREATE OR REPLACE FUNCTION public.load_workshop_transaction(p_session_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE v_table text; v_tables jsonb:='{}'; v_keys jsonb:='{}'; v_pk jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM sessions WHERE id=p_session_id) THEN RAISE EXCEPTION 'Workshop not found'; END IF;
 FOREACH v_table IN ARRAY public.workshop_transaction_tables(p_session_id) LOOP
   v_tables:=v_tables || jsonb_build_object(v_table,public.workshop_transaction_rows(p_session_id,v_table));
   SELECT jsonb_agg(a.attname ORDER BY k.ordinality) INTO v_pk FROM pg_index i
   CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY k(attnum,ordinality)
   JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum
   WHERE i.indrelid=to_regclass('public.'||v_table) AND i.indisprimary;
   IF v_pk IS NULL THEN RAISE EXCEPTION 'Workshop table needs a primary key: %',v_table; END IF;
   v_keys:=v_keys || jsonb_build_object(v_table,v_pk);
 END LOOP;
 RETURN jsonb_build_object('tables',v_tables,'keys',v_keys);
END $$;

-- Evaluate actual column defaults without inserting any durable game rows.
-- Sequence gaps are normal, just as after a rolled-back INSERT.
CREATE OR REPLACE FUNCTION public.prepare_workshop_rows(p_session_id uuid,p_table text,p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_row jsonb; v_column record; v_select text; v_result jsonb; v_rows jsonb:='[]';
BEGIN
 IF NOT (p_table=ANY(public.workshop_transaction_tables(p_session_id))) THEN RAISE EXCEPTION 'Undeclared workshop table'; END IF;
 FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  v_select:='';
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(v_row) k WHERE NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.'||p_table) AND attname=k AND attnum>0 AND NOT attisdropped)) THEN RAISE EXCEPTION 'Unknown workshop column'; END IF;
  FOR v_column IN SELECT a.attname,pg_get_expr(d.adbin,d.adrelid) AS expression FROM pg_attribute a
   LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
   WHERE a.attrelid=to_regclass('public.'||p_table) AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum LOOP
   v_select:=v_select || CASE WHEN v_select='' THEN '' ELSE ',' END ||
    CASE WHEN v_row ? v_column.attname THEN format('(jsonb_populate_record(NULL::public.%I,$1)).%I',p_table,v_column.attname)
     ELSE COALESCE(v_column.expression,'NULL') END || format(' AS %I',v_column.attname);
  END LOOP;
  EXECUTE 'SELECT to_jsonb(r) FROM (SELECT '||v_select||') r' INTO v_result USING v_row;
  v_rows:=v_rows || jsonb_build_array(v_result);
 END LOOP;
 RETURN v_rows;
END $$;

CREATE OR REPLACE FUNCTION public.commit_workshop_transaction(p_session_id uuid,p_snapshot jsonb,p_operations jsonb,p_input_deadline timestamptz DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_table text; v_op jsonb; v_columns text; v_select text; v_set text; v_key jsonb; v_value jsonb; v_changed integer; v_team uuid;
BEGIN
 -- Lock ordering is team, parent session, then protocol rows. The team lock
 -- also protects OTSP's rotation debt shared by multiple sessions.
 SELECT team_id INTO v_team FROM sessions WHERE id=p_session_id;
 PERFORM 1 FROM teams WHERE id=v_team FOR UPDATE;
 PERFORM 1 FROM sessions WHERE id=p_session_id FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF p_input_deadline IS NOT NULL AND clock_timestamp()>=p_input_deadline THEN RAISE EXCEPTION 'Input deadline passed before commit' USING ERRCODE='40001'; END IF;
 FOREACH v_table IN ARRAY public.workshop_transaction_tables(p_session_id) LOOP
  IF public.workshop_transaction_rows(p_session_id,v_table) IS DISTINCT FROM p_snapshot->v_table THEN RETURN false; END IF;
 END LOOP;
 FOR v_op IN SELECT value FROM jsonb_array_elements(p_operations) LOOP
  v_table:=v_op->>'table'; v_key:=v_op->'key'; v_value:=v_op->'value';
  IF NOT(v_table=ANY(public.workshop_transaction_tables(p_session_id))) THEN RAISE EXCEPTION 'Undeclared workshop write'; END IF;
  IF v_table='sessions' AND v_key->>'id' IS DISTINCT FROM p_session_id::text THEN RAISE EXCEPTION 'Cross-session root write'; END IF;
  IF v_op->>'kind'<>'insert' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.workshop_transaction_rows(p_session_id,v_table)) r WHERE r @> v_key) THEN RAISE EXCEPTION 'Cross-session workshop write'; END IF;
  IF v_op->>'kind'='delete' THEN
   EXECUTE format('DELETE FROM public.%I t WHERE to_jsonb(t) @> $1',v_table) USING v_key;
  ELSIF v_op->>'kind' IN ('insert','update') THEN
   SELECT string_agg(format('%I',key),','),string_agg(format('(jsonb_populate_record(NULL::public.%I,$1)).%I',v_table,key),','),
    string_agg(format('%I=(jsonb_populate_record(NULL::public.%I,$1)).%I',key,v_table,key),',')
   INTO v_columns,v_select,v_set FROM jsonb_object_keys(v_value) key;
   IF v_op->>'kind'='insert' THEN
    EXECUTE format('INSERT INTO public.%I (%s) SELECT %s',v_table,v_columns,v_select) USING v_value;
   ELSE EXECUTE format('UPDATE public.%I t SET %s WHERE to_jsonb(t) @> $2',v_table,v_set) USING v_value,v_key; END IF;
   GET DIAGNOSTICS v_changed=ROW_COUNT;
   IF v_changed<>1 THEN RAISE EXCEPTION 'Workshop write did not affect exactly one row'; END IF;
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.workshop_transaction_rows(p_session_id,v_table)) r WHERE r @> v_key) THEN RAISE EXCEPTION 'Workshop write escaped its session'; END IF;
  ELSE RAISE EXCEPTION 'Unsupported workshop operation'; END IF;
 END LOOP;
 -- Every durable operation invalidates old shared reads, even a private input.
 UPDATE session_state SET revision=revision WHERE session_id=p_session_id;
 RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.workshop_transaction_tables(uuid),public.workshop_transaction_rows(uuid,text),public.load_workshop_transaction(uuid),public.prepare_workshop_rows(uuid,text,jsonb),public.commit_workshop_transaction(uuid,jsonb,jsonb,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.workshop_transaction_tables(uuid),public.workshop_transaction_rows(uuid,text),public.load_workshop_transaction(uuid),public.prepare_workshop_rows(uuid,text,jsonb),public.commit_workshop_transaction(uuid,jsonb,jsonb,timestamptz) TO service_role;

COMMIT;
