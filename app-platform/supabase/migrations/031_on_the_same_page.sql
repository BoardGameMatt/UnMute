-- On the Same Page: protocol, Pack A, secret live state.
-- Open session_state must not carry the picture, roles, guesses, pins, or reaction authors.

INSERT INTO public.protocols (slug, name, description, type, min_players, max_players)
VALUES (
  'on-the-same-page',
  'On the Same Page',
  'Five players build a picture. Four know it. One is improvising. Everyone else names the picture and spots the Improviser.',
  'realtime',
  8,
  16
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.content_packs (protocol_id, slug, label, subtitle, sort_order, status)
SELECT p.id, 'a', 'Pack A', '50 pictures in five families', 1, 'active'
FROM public.protocols p
WHERE p.slug = 'on-the-same-page'
ON CONFLICT (protocol_id, slug) DO NOTHING;

CREATE TABLE public.otsp_pictures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_pack_id uuid NOT NULL REFERENCES public.content_packs (id) ON DELETE RESTRICT,
  slug text NOT NULL,
  label text NOT NULL,
  family text NOT NULL,
  starter boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT otsp_pictures_family_check CHECK (
    family IN ('round', 'peaked', 'long', 'boxy', 'distinct')
  ),
  CONSTRAINT otsp_pictures_pack_slug_unique UNIQUE (content_pack_id, slug)
);

CREATE INDEX otsp_pictures_pack_active_idx ON public.otsp_pictures (content_pack_id, active);

INSERT INTO public.otsp_pictures (content_pack_id, slug, label, family, starter, sort_order)
SELECT pack.id, picture.slug, picture.label, picture.family, picture.starter, picture.sort_order
FROM public.content_packs pack
CROSS JOIN (
  VALUES
    ('alarm-clock', 'Alarm clock', 'round', false, 1),
    ('apple', 'Apple', 'round', true, 2),
    ('cat', 'Cat', 'round', false, 3),
    ('ghost', 'Ghost', 'round', false, 4),
    ('guitar', 'Guitar', 'round', true, 5),
    ('hot-air-balloon', 'Hot air balloon', 'round', false, 6),
    ('ladybug', 'Ladybug', 'round', true, 7),
    ('light-bulb', 'Light bulb', 'round', false, 8),
    ('rabbit', 'Rabbit', 'round', false, 9),
    ('tree', 'Tree', 'round', false, 10),
    ('bell', 'Bell', 'peaked', false, 11),
    ('house', 'House', 'peaked', false, 12),
    ('kite', 'Kite', 'peaked', false, 13),
    ('lighthouse', 'Lighthouse', 'peaked', false, 14),
    ('mushroom', 'Mushroom', 'peaked', false, 15),
    ('pine-tree', 'Pine tree', 'peaked', false, 16),
    ('rocket', 'Rocket', 'peaked', true, 17),
    ('sailboat', 'Sailboat', 'peaked', true, 18),
    ('table-lamp', 'Table lamp', 'peaked', false, 19),
    ('umbrella', 'Umbrella', 'peaked', false, 20),
    ('boot', 'Boot', 'long', false, 21),
    ('bus', 'Bus', 'long', false, 22),
    ('car', 'Car', 'long', true, 23),
    ('fish', 'Fish', 'long', true, 24),
    ('key', 'Key', 'long', true, 25),
    ('snail', 'Snail', 'long', false, 26),
    ('submarine', 'Submarine', 'long', true, 27),
    ('tractor', 'Tractor', 'long', false, 28),
    ('train', 'Train', 'long', false, 29),
    ('turtle', 'Turtle', 'long', false, 30),
    ('bed', 'Bed', 'boxy', false, 31),
    ('castle', 'Castle', 'boxy', false, 32),
    ('chair', 'Chair', 'boxy', true, 33),
    ('gift', 'Gift', 'boxy', false, 34),
    ('laptop', 'Laptop', 'boxy', false, 35),
    ('mug', 'Mug', 'boxy', true, 36),
    ('teapot', 'Teapot', 'boxy', true, 37),
    ('television', 'Television', 'boxy', false, 38),
    ('toaster', 'Toaster', 'boxy', false, 39),
    ('top-hat', 'Top hat', 'boxy', true, 40),
    ('airplane', 'Airplane', 'distinct', false, 41),
    ('cactus', 'Cactus', 'distinct', false, 42),
    ('candle', 'Candle', 'distinct', true, 43),
    ('crown', 'Crown', 'distinct', false, 44),
    ('flower', 'Flower', 'distinct', true, 45),
    ('heart', 'Heart', 'distinct', false, 46),
    ('hourglass', 'Hourglass', 'distinct', true, 47),
    ('ladder', 'Ladder', 'distinct', false, 48),
    ('robot', 'Robot', 'distinct', false, 49),
    ('trophy', 'Trophy', 'distinct', false, 50)
) AS picture(slug, label, family, starter, sort_order)
WHERE pack.slug = 'a'
  AND pack.protocol_id = (SELECT id FROM public.protocols WHERE slug = 'on-the-same-page')
ON CONFLICT (content_pack_id, slug) DO NOTHING;

CREATE TABLE public.otsp_sessions (
  session_id uuid PRIMARY KEY REFERENCES public.sessions (id) ON DELETE CASCADE,
  phase text NOT NULL DEFAULT 'deal',
  version integer NOT NULL DEFAULT 0,
  game_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT otsp_sessions_phase_check CHECK (
    phase IN ('deal', 'build', 'checkin', 'final_lock', 'reveal', 'scoreboard')
  )
);

CREATE TABLE public.otsp_rounds (
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  picture_slug text NOT NULL,
  family text NOT NULL,
  seed integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, round_number)
);

CREATE INDEX otsp_rounds_picture_idx ON public.otsp_rounds (picture_slug);

CREATE TABLE public.otsp_events (
  id bigserial PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  type text NOT NULL,
  actor_id uuid,
  actor_role text,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX otsp_events_session_idx ON public.otsp_events (session_id, round_number, created_at);

CREATE TABLE public.otsp_rotation_debt (
  team_id uuid NOT NULL REFERENCES public.teams (id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants (id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, participant_id)
);

ALTER TABLE public.otsp_pictures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otsp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otsp_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otsp_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otsp_rotation_debt ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.otsp_pictures
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role only" ON public.otsp_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role only" ON public.otsp_rounds
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role only" ON public.otsp_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role only" ON public.otsp_rotation_debt
  FOR ALL TO service_role USING (true) WITH CHECK (true);
