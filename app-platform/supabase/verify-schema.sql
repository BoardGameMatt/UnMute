-- Production schema audit for Unmute Labs.
-- Run in Supabase SQL editor (production project).
-- Any returned row = missing object; apply the migration file listed.

WITH expected AS (
  -- Core (001)
  SELECT '001_initial_schema.sql' AS migration, 'table' AS kind, 'sessions' AS object_name, NULL::text AS parent_table
  UNION ALL SELECT '001_initial_schema.sql', 'table', 'protocols', NULL
  UNION ALL SELECT '001_initial_schema.sql', 'table', 'session_state', NULL
  -- Draw It By Ear (003)
  UNION ALL SELECT '003_draw_it_by_ear.sql', 'table', 'protocol_images', NULL
  UNION ALL SELECT '003_draw_it_by_ear.sql', 'table', 'dibe_teams', NULL
  -- Session feedback (002)
  UNION ALL SELECT '002_session_feedback.sql', 'table', 'session_feedback', NULL
  -- Host / lead (005–006)
  UNION ALL SELECT '005_session_lead_designation.sql', 'column', 'designated_lead_name', 'sessions'
  UNION ALL SELECT '006_session_host_token.sql', 'column', 'host_token', 'sessions'
  -- WAO (008–012)
  UNION ALL SELECT '008_wrong_answers_only.sql', 'table', 'wao_questions', NULL
  UNION ALL SELECT '008_wrong_answers_only.sql', 'table', 'wao_pairs', NULL
  UNION ALL SELECT '009_session_participant_department.sql', 'column', 'department', 'session_participants'
  -- Trane Quiz (013)
  UNION ALL SELECT '013_trane_quiz.sql', 'table', 'trane_offerings', NULL
  UNION ALL SELECT '013_trane_quiz.sql', 'table', 'trane_participants', NULL
  -- Cover Story (014–018)
  UNION ALL SELECT '014_cover_story.sql', 'table', 'cover_story_agencies', NULL
  UNION ALL SELECT '014_cover_story.sql', 'table', 'cover_story_deals', NULL
  UNION ALL SELECT '014_cover_story.sql', 'table', 'cover_story_sessions', NULL
  UNION ALL SELECT '016_cover_story_mission_report.sql', 'column', 'note', 'cover_story_word_logs'
  UNION ALL SELECT '018_cover_story_pick_token.sql', 'column', 'pick_token', 'cover_story_deals'
  -- Talk Track (019)
  UNION ALL SELECT '019_talk_track.sql', 'table', 'content_packs', NULL
  UNION ALL SELECT '019_talk_track.sql', 'table', 'talk_track_cards', NULL
  UNION ALL SELECT '019_talk_track.sql', 'table', 'talk_track_sessions', NULL
  UNION ALL SELECT '019_talk_track.sql', 'column', 'content_pack_id', 'sessions'
  -- Unmute Console (020)
  UNION ALL SELECT '020_unmute_console.sql', 'table', 'clients', NULL
  UNION ALL SELECT '020_unmute_console.sql', 'table', 'staff_profiles', NULL
  UNION ALL SELECT '020_unmute_console.sql', 'table', 'session_events', NULL
  UNION ALL SELECT '020_unmute_console.sql', 'column', 'client_id', 'teams'
  -- Zoning Rights (021)
  UNION ALL SELECT '021_zoning_rights.sql', 'table', 'zoning_rights_buildings', NULL
  UNION ALL SELECT '021_zoning_rights.sql', 'table', 'zoning_rights_sessions', NULL
  UNION ALL SELECT '021_zoning_rights.sql', 'table', 'zoning_rights_rounds', NULL
  UNION ALL SELECT '021_zoning_rights.sql', 'table', 'zoning_rights_guesses', NULL
  -- 022 drops team_round_index <= 3; no new object to detect.
  -- I Know What You Meme (023)
  UNION ALL SELECT '023_ikwym.sql', 'table', 'ikwym_prompts', NULL
  UNION ALL SELECT '023_ikwym.sql', 'table', 'ikwym_sessions', NULL
  UNION ALL SELECT '023_ikwym.sql', 'table', 'ikwym_responses', NULL
  UNION ALL SELECT '023_ikwym.sql', 'table', 'ikwym_reveal_items', NULL
  UNION ALL SELECT '023_ikwym.sql', 'table', 'ikwym_guesses', NULL
  -- SwitchCode (025)
  UNION ALL SELECT '025_code_switch.sql', 'table', 'code_switch_words', NULL
  UNION ALL SELECT '025_code_switch.sql', 'table', 'code_switch_sessions', NULL
  UNION ALL SELECT '025_code_switch.sql', 'table', 'code_switch_rounds', NULL
  UNION ALL SELECT '025_code_switch.sql', 'table', 'code_switch_clues', NULL
  -- Rank and File (027)
  UNION ALL SELECT '027_rank_and_file.sql', 'table', 'rank_and_file_subjects', NULL
  UNION ALL SELECT '027_rank_and_file.sql', 'table', 'rank_and_file_sessions', NULL
  UNION ALL SELECT '027_rank_and_file.sql', 'table', 'rank_and_file_rounds', NULL
  UNION ALL SELECT '027_rank_and_file.sql', 'table', 'rank_and_file_deals', NULL
  -- The Truth Is (028)
  UNION ALL SELECT '028_the_truth_is.sql', 'table', 'truth_is_sessions', NULL
  UNION ALL SELECT '028_the_truth_is.sql', 'table', 'truth_is_entries', NULL
  -- Airtime (030)
  UNION ALL SELECT '030_airtime.sql', 'table', 'airtime_sessions', NULL
  UNION ALL SELECT '030_airtime.sql', 'table', 'airtime_boats', NULL
  UNION ALL SELECT '030_airtime.sql', 'table', 'airtime_boat_members', NULL
  UNION ALL SELECT '030_airtime.sql', 'table', 'airtime_dives', NULL
  UNION ALL SELECT '030_airtime.sql', 'table', 'airtime_boat_dives', NULL
  UNION ALL SELECT '030_airtime.sql', 'table', 'airtime_diver_dives', NULL
  UNION ALL SELECT '030_airtime.sql', 'table', 'airtime_choices', NULL
  UNION ALL SELECT '030_airtime.sql', 'table', 'airtime_events', NULL
  UNION ALL SELECT '031_on_the_same_page.sql', 'table', 'otsp_pictures', NULL
  UNION ALL SELECT '031_on_the_same_page.sql', 'table', 'otsp_sessions', NULL
  UNION ALL SELECT '031_on_the_same_page.sql', 'table', 'otsp_rounds', NULL
  UNION ALL SELECT '031_on_the_same_page.sql', 'table', 'otsp_events', NULL
  UNION ALL SELECT '031_on_the_same_page.sql', 'table', 'otsp_rotation_debt', NULL
  UNION ALL SELECT '032_say_less.sql', 'table', 'say_less_cards', NULL
  UNION ALL SELECT '032_say_less.sql', 'table', 'say_less_sessions', NULL
  UNION ALL SELECT '032_say_less.sql', 'table', 'say_less_teams', NULL
  UNION ALL SELECT '032_say_less.sql', 'table', 'say_less_previews', NULL
  UNION ALL SELECT '032_say_less.sql', 'table', 'say_less_turns', NULL
  UNION ALL SELECT '032_say_less.sql', 'table', 'say_less_card_events', NULL
  UNION ALL SELECT '033_atomic_workshop_transitions.sql', 'function', 'publish_workshop_state(uuid,text,text,jsonb)', NULL
  UNION ALL SELECT '033_atomic_workshop_transitions.sql', 'function', 'commit_code_switch_transition(uuid,uuid,text,text,jsonb,jsonb,integer,jsonb)', NULL
  UNION ALL SELECT '033_atomic_workshop_transitions.sql', 'function', 'lock_code_switch_clue(uuid,uuid,uuid,text,text)', NULL
  UNION ALL SELECT '033_atomic_workshop_transitions.sql', 'function', 'commit_say_less_turn(uuid,integer,uuid,jsonb,jsonb,text)', NULL
  UNION ALL SELECT '033_atomic_workshop_transitions.sql', 'function', 'workshop_transaction_schema_ready()', NULL
  UNION ALL SELECT '034_browser_input_recovery.sql', 'column', 'operation_id', 'say_less_card_events'
  UNION ALL SELECT '034_browser_input_recovery.sql', 'column', 'operation_version', 'say_less_card_events'
  UNION ALL SELECT '034_browser_input_recovery.sql', 'unique_index', 'say_less_card_operation_once', NULL
  UNION ALL SELECT '034_browser_input_recovery.sql', 'function', 'workshop_browser_recovery_schema_ready()', NULL
  UNION ALL SELECT '035_session_snapshot_revision.sql', 'column', 'revision', 'session_state'
  UNION ALL SELECT '035_session_snapshot_revision.sql', 'trigger', 'session_snapshot_revision', 'session_state'
  UNION ALL SELECT '036_workshop_lifecycle.sql', 'column', 'lifecycle_version', 'sessions'
  UNION ALL SELECT '036_workshop_lifecycle.sql', 'function', 'start_workshop_session(uuid,text,integer,jsonb)', NULL
  UNION ALL SELECT '036_workshop_lifecycle.sql', 'function', 'reset_workshop_session(uuid,integer)', NULL
  UNION ALL SELECT '036_workshop_lifecycle.sql', 'function', 'commit_say_less_setup(uuid,integer,text,jsonb,jsonb,jsonb,jsonb)', NULL
  UNION ALL SELECT '036_workshop_lifecycle.sql', 'function', 'start_code_switch_round(uuid,uuid,jsonb)', NULL
  UNION ALL SELECT '036_workshop_lifecycle.sql', 'function', 'finish_code_switch_phase(uuid,uuid,boolean)', NULL
  UNION ALL SELECT '036_workshop_lifecycle.sql', 'function', 'complete_say_less_session(uuid,integer)', NULL
  UNION ALL SELECT '036_workshop_lifecycle.sql', 'function', 'workshop_session_reliability_schema_ready()', NULL
  UNION ALL SELECT '037_remaining_workshop_transactions.sql', 'table', 'workshop_action_receipts', NULL
  UNION ALL SELECT '037_remaining_workshop_transactions.sql', 'function', 'load_workshop_transaction(uuid)', NULL
  UNION ALL SELECT '037_remaining_workshop_transactions.sql', 'function', 'prepare_workshop_rows(uuid,text,jsonb)', NULL
  UNION ALL SELECT '037_remaining_workshop_transactions.sql', 'function', 'commit_workshop_transaction(uuid,jsonb,jsonb,timestamp with time zone)', NULL
  UNION ALL SELECT '038_json_and_pair_workshop_guards.sql', 'function', 'lookup_workshop_receipt(uuid,integer,uuid,uuid,jsonb)', NULL
  UNION ALL SELECT '038_json_and_pair_workshop_guards.sql', 'function', 'commit_dibe_snapshot(uuid,integer,bigint,uuid,uuid,jsonb,jsonb)', NULL
  UNION ALL SELECT '038_json_and_pair_workshop_guards.sql', 'function', 'record_wao_tap(uuid,uuid,uuid,text,integer,uuid)', NULL
  UNION ALL SELECT '038_json_and_pair_workshop_guards.sql', 'function', 'workshop_remaining_reliability_schema_ready()', NULL
  UNION ALL SELECT '038_json_and_pair_workshop_guards.sql', 'column', 'operation_id', 'wao_taps'
  UNION ALL SELECT '038_json_and_pair_workshop_guards.sql', 'unique_index', 'wao_tap_operation_unique', NULL
  UNION ALL SELECT '038_json_and_pair_workshop_guards.sql', 'trigger', 'dibe_snapshot_side_effects', 'session_state'
  UNION ALL SELECT '038_json_and_pair_workshop_guards.sql', 'trigger', 'wao_tap_admission', 'wao_taps'
  UNION ALL SELECT '038_json_and_pair_workshop_guards.sql', 'trigger', 'wao_session_lifecycle', 'sessions'
),
present AS (
  SELECT
    e.migration,
    e.kind,
    e.object_name,
    e.parent_table,
    CASE
      WHEN e.kind = 'table' THEN EXISTS (
        SELECT 1
        FROM information_schema.tables t
        WHERE t.table_schema = 'public'
          AND t.table_name = e.object_name
      )
      WHEN e.kind = 'column' THEN EXISTS (
        SELECT 1
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = e.parent_table
          AND c.column_name = e.object_name
      )
      WHEN e.kind = 'function' THEN to_regprocedure('public.' || e.object_name) IS NOT NULL
      WHEN e.kind = 'trigger' THEN EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.' || e.parent_table)
          AND tgname=e.object_name AND tgenabled IN ('O','A')
      )
      WHEN e.kind = 'unique_index' THEN EXISTS (
        SELECT 1 FROM pg_index WHERE indexrelid = to_regclass('public.' || e.object_name) AND indisunique
      )
      ELSE false
    END AS ok
  FROM expected e
)
SELECT migration, kind, object_name, parent_table
FROM present
WHERE NOT ok
ORDER BY migration, kind, object_name;
