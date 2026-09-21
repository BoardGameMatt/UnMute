-- Rank and File: protocol row, Pack A subjects, live session tables.

INSERT INTO public.protocols (slug, name, description, type, min_players, max_players)
VALUES (
  'rank-and-file',
  'Rank and File',
  'A subset of the room writes examples at a secret number on a shared scale. The team ranks them from low to high.',
  'realtime',
  3,
  20
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.content_packs (protocol_id, slug, label, subtitle, sort_order, status)
SELECT p.id, 'a', 'Pack A', '51 subjects: example, general calibration, team behaviors', 1, 'active'
FROM public.protocols p
WHERE p.slug = 'rank-and-file'
ON CONFLICT (protocol_id, slug) DO NOTHING;

CREATE TABLE public.rank_and_file_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_pack_id uuid NOT NULL REFERENCES public.content_packs (id) ON DELETE RESTRICT,
  pack_index integer NOT NULL,
  theme text NOT NULL,
  low_end text NOT NULL,
  high_end text NOT NULL,
  category text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rank_and_file_subjects_category_check CHECK (
    category IN ('example', 'general_calibration', 'team_behaviors')
  ),
  CONSTRAINT rank_and_file_subjects_pack_index_unique UNIQUE (content_pack_id, pack_index)
);

CREATE INDEX rank_and_file_subjects_pack_active_idx
  ON public.rank_and_file_subjects (content_pack_id, active);

CREATE TABLE public.rank_and_file_sessions (
  session_id uuid PRIMARY KEY REFERENCES public.sessions (id) ON DELETE CASCADE,
  phase text NOT NULL DEFAULT 'write',
  round_index integer NOT NULL DEFAULT 0,
  current_round_id uuid,
  hits integer NOT NULL DEFAULT 0,
  committed_rounds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rank_and_file_sessions_phase_check CHECK (
    phase IN ('write', 'rank', 'reveal', 'scoreboard')
  ),
  CONSTRAINT rank_and_file_sessions_hits_check CHECK (hits >= 0),
  CONSTRAINT rank_and_file_sessions_committed_check CHECK (committed_rounds >= 0)
);

CREATE TABLE public.rank_and_file_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  round_index integer NOT NULL,
  subject_id uuid NOT NULL REFERENCES public.rank_and_file_subjects (id) ON DELETE RESTRICT,
  k integer NOT NULL,
  write_started_at timestamptz,
  rank_started_at timestamptz,
  committed_at timestamptz,
  rail_order_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_hit boolean,
  ended_at timestamptz,
  end_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rank_and_file_rounds_round_index_check CHECK (round_index >= 1),
  CONSTRAINT rank_and_file_rounds_k_check CHECK (k >= 1),
  CONSTRAINT rank_and_file_rounds_end_reason_check CHECK (
    end_reason IS NULL OR end_reason IN ('commit', 'zero_tiles', 'abandoned')
  ),
  CONSTRAINT rank_and_file_rounds_session_index_unique UNIQUE (session_id, round_index)
);

CREATE INDEX rank_and_file_rounds_session_id_idx ON public.rank_and_file_rounds (session_id);

ALTER TABLE public.rank_and_file_sessions
  ADD CONSTRAINT rank_and_file_sessions_current_round_fk
  FOREIGN KEY (current_round_id) REFERENCES public.rank_and_file_rounds (id) ON DELETE SET NULL;

CREATE TABLE public.rank_and_file_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.rank_and_file_rounds (id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants (id) ON DELETE RESTRICT,
  dealt_number integer NOT NULL,
  clue_text text,
  locked_at timestamptz,
  CONSTRAINT rank_and_file_deals_number_check CHECK (dealt_number BETWEEN 1 AND 99),
  CONSTRAINT rank_and_file_deals_round_participant_unique UNIQUE (round_id, participant_id),
  CONSTRAINT rank_and_file_deals_round_number_unique UNIQUE (round_id, dealt_number)
);

CREATE INDEX rank_and_file_deals_round_id_idx ON public.rank_and_file_deals (round_id);

INSERT INTO public.rank_and_file_subjects (
  content_pack_id, pack_index, theme, low_end, high_end, category
)
SELECT pack.id, s.pack_index, s.theme, s.low_end, s.high_end, s.category
FROM public.content_packs pack
JOIN public.protocols p ON p.id = pack.protocol_id
CROSS JOIN (
  VALUES
    (0, 'Breakfast foods', 'Sad', 'Glorious', 'example'),
    (1, 'Things you do when you''re in a good mood', 'Don''t do', 'Do', 'general_calibration'),
    (2, 'Things that are still fashionable today', 'Not at all', 'Absolutely', 'general_calibration'),
    (3, 'Things you''d do differently if nobody could see you', 'Same either way', 'Completely different', 'general_calibration'),
    (4, 'Things you''d cancel plans for', 'Wouldn''t cancel', 'Cancel instantly', 'general_calibration'),
    (5, 'Things worth waking up early for', 'Not a chance', 'Set two alarms', 'general_calibration'),
    (6, 'Things you''d admit to a stranger on a plane', 'Never', 'Immediately', 'general_calibration'),
    (7, 'Ways people show they care', 'Doesn''t land for me', 'Lands completely', 'general_calibration'),
    (8, 'Ways to spend an unexpected free hour', 'Wasted it', 'Perfect use of it', 'general_calibration'),
    (9, 'Things people pretend to enjoy', 'Genuinely enjoy it', 'Pure performance', 'general_calibration'),
    (10, 'Skills you''d want if you had to start over', 'Useless now', 'Would change everything', 'general_calibration'),
    (11, 'Compliments', 'Means nothing', 'Would make my month', 'general_calibration'),
    (12, 'Things worth paying extra for', 'Never worth it', 'Always worth it', 'general_calibration'),
    (13, 'Advice you were given growing up', 'Terrible', 'Held up perfectly', 'general_calibration'),
    (14, 'Things people are secretly competitive about', 'Nobody cares', 'Absolutely ruthless', 'general_calibration'),
    (15, 'Ways to be remembered', 'Forgotten in a week', 'Talked about for years', 'general_calibration'),
    (16, 'Things that are harder than they look', 'Exactly as hard as it looks', 'Far harder', 'general_calibration'),
    (17, 'Things you''d do to avoid making a phone call', 'Just make the call', 'Anything but that', 'general_calibration'),
    (18, 'Things worth waiting in line for', 'Walk away', 'Wait two hours', 'general_calibration'),
    (19, 'Music you''d admit to liking', 'Proud of it', 'Would deny it under oath', 'general_calibration'),
    (20, 'Ways to spend money you didn''t expect', 'Irresponsible', 'Wise', 'general_calibration'),
    (21, 'Things you''d want to know in advance', 'Rather be surprised', 'Tell me right now', 'general_calibration'),
    (22, 'Things you''d never do again', 'Would do tomorrow', 'Never again', 'general_calibration'),
    (23, 'Ways to react to bad news', 'Underreacting', 'Overreacting', 'general_calibration'),
    (24, 'Things worth an argument', 'Let it go', 'Worth the fight', 'general_calibration'),
    (25, 'Things you''d want to be good at', 'Wouldn''t help me', 'Would change my life', 'general_calibration'),
    (26, 'Things that happen in our meetings', 'Never', 'Every single time', 'team_behaviors'),
    (27, 'Reasons to message someone at work', 'Would feel odd', 'Completely normal', 'team_behaviors'),
    (28, 'Ways to open a work message', 'Cold', 'Warm', 'team_behaviors'),
    (29, 'Interruptions', 'Welcome', 'Costly', 'team_behaviors'),
    (30, 'Phrases in a work message', 'No urgency at all', 'Drop everything', 'team_behaviors'),
    (31, 'Ways to say no to a colleague', 'Soft', 'Final', 'team_behaviors'),
    (32, 'Things you''d ask a colleague for help with', 'Would just ask', 'Would struggle alone first', 'team_behaviors'),
    (33, 'Requests from a colleague', 'You''d do it today', 'You''d hope they forget', 'team_behaviors'),
    (34, 'Ways people signal they''re overloaded', 'Nobody would catch it', 'Impossible to miss', 'team_behaviors'),
    (35, 'Ways to give someone critical feedback', 'Gentle', 'Blunt', 'team_behaviors'),
    (36, 'Things teams say they''ll do', 'Never happens', 'Always happens', 'team_behaviors'),
    (37, 'Decisions at work', 'One person can make it', 'Needs everyone in the room', 'team_behaviors'),
    (38, 'Things worth escalating', 'Handle it yourself', 'Escalate immediately', 'team_behaviors'),
    (39, 'Ways people find out what''s really going on here', 'Never works', 'Always works', 'team_behaviors'),
    (40, 'Ways to know someone is finished with something', 'Ambiguous', 'Unmistakable', 'team_behaviors'),
    (41, 'Things you''d need to cover someone''s job for a week', 'Trivial', 'You''d be lost', 'team_behaviors'),
    (42, 'Reasons to follow up with someone', 'Would feel like nagging', 'Completely normal', 'team_behaviors'),
    (43, 'Reasons to turn your camera on', 'Doesn''t matter', 'Would feel wrong not to', 'team_behaviors'),
    (44, 'Things worth putting in writing', 'Just say it', 'Always write it down', 'team_behaviors'),
    (45, 'Ways a decision gets communicated', 'Everyone missed it', 'Nobody could miss it', 'team_behaviors'),
    (46, 'Ways to disagree in a meeting', 'Wouldn''t register', 'Would stop the meeting', 'team_behaviors'),
    (47, 'Unwritten rules on a team', 'Nobody would care', 'Real consequences', 'team_behaviors'),
    (48, 'Questions you could ask in a meeting', 'No risk at all', 'Room goes quiet', 'team_behaviors'),
    (49, 'Things people notice but don''t say', 'Not worth mentioning', 'Everyone is thinking it', 'team_behaviors'),
    (50, 'Feedback you''ve received', 'Didn''t stick', 'Changed how I work', 'team_behaviors')
) AS s(pack_index, theme, low_end, high_end, category)
WHERE p.slug = 'rank-and-file' AND pack.slug = 'a';

ALTER TABLE public.rank_and_file_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rank_and_file_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rank_and_file_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rank_and_file_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.rank_and_file_subjects
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.rank_and_file_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.rank_and_file_rounds
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.rank_and_file_deals
  FOR ALL TO service_role USING (true) WITH CHECK (true);
