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
      ELSE false
    END AS ok
  FROM expected e
)
SELECT migration, kind, object_name, parent_table
FROM present
WHERE NOT ok
ORDER BY migration, kind, object_name;
