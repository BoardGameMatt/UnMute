-- Say Less: one pack, five categories × 15 cards, live session tables.

INSERT INTO public.protocols (slug, name, description, type, min_players, max_players)
VALUES (
  'say-less',
  'Say Less',
  'Two teams build a shared shorthand: describe freely, then the same cards in one word.',
  'realtime',
  4,
  14
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.content_packs (protocol_id, slug, label, subtitle, sort_order, status)
SELECT p.id, 'a', 'Pack A', 'Five categories, 75 cards', 1, 'active'
FROM public.protocols p
WHERE p.slug = 'say-less'
ON CONFLICT (protocol_id, slug) DO NOTHING;

CREATE TABLE public.say_less_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_pack_id uuid NOT NULL REFERENCES public.content_packs (id) ON DELETE RESTRICT,
  category text NOT NULL,
  name text NOT NULL,
  hint text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT say_less_cards_category_check CHECK (
    category IN (
      'automotive-fleet',
      'life-sciences',
      'inventors',
      'musicians',
      'movie-people'
    )
  ),
  CONSTRAINT say_less_cards_name_len CHECK (char_length(btrim(name)) > 0),
  CONSTRAINT say_less_cards_hint_len CHECK (char_length(btrim(hint)) > 0),
  CONSTRAINT say_less_cards_pack_category_name_unique UNIQUE (content_pack_id, category, name)
);

CREATE INDEX say_less_cards_pack_category_active_idx
  ON public.say_less_cards (content_pack_id, category, active);

CREATE TABLE public.say_less_sessions (
  session_id uuid PRIMARY KEY REFERENCES public.sessions (id) ON DELETE CASCADE,
  phase text NOT NULL DEFAULT 'lobby',
  category_a text NOT NULL DEFAULT 'automotive-fleet',
  category_b text NOT NULL DEFAULT 'movie-people',
  deck_card_ids uuid[] NOT NULL DEFAULT '{}',
  round smallint NOT NULL DEFAULT 1,
  pile_card_ids uuid[] NOT NULL DEFAULT '{}',
  first_team text NOT NULL DEFAULT 'A',
  next_team text NOT NULL DEFAULT 'A',
  cursor_a integer NOT NULL DEFAULT 0,
  cursor_b integer NOT NULL DEFAULT 0,
  current_turn_id uuid,
  phase_deadline timestamptz,
  hold_started_at timestamptz,
  paused boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 0,
  last_turn_got_it integer,
  last_turn_end_reason text,
  round_1_ended_early boolean NOT NULL DEFAULT false,
  round_2_ended_early boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT say_less_sessions_phase_check CHECK (
    phase IN (
      'lobby',
      'teams',
      'preview',
      'ready',
      'turn',
      'hold',
      'round_break',
      'final_scores'
    )
  ),
  CONSTRAINT say_less_sessions_round_check CHECK (round IN (1, 2)),
  CONSTRAINT say_less_sessions_team_check CHECK (
    first_team IN ('A', 'B') AND next_team IN ('A', 'B')
  ),
  CONSTRAINT say_less_sessions_category_check CHECK (
    category_a IN (
      'automotive-fleet',
      'life-sciences',
      'inventors',
      'musicians',
      'movie-people'
    )
    AND category_b IN (
      'automotive-fleet',
      'life-sciences',
      'inventors',
      'musicians',
      'movie-people'
    )
    AND category_a <> category_b
  ),
  CONSTRAINT say_less_sessions_end_reason_check CHECK (
    last_turn_end_reason IS NULL
    OR last_turn_end_reason IN ('timer', 'pile_empty', 'skipped', 'round_ended')
  )
);

CREATE TABLE public.say_less_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  label text NOT NULL,
  member_ids uuid[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT say_less_teams_label_check CHECK (label IN ('A', 'B')),
  CONSTRAINT say_less_teams_session_label_unique UNIQUE (session_id, label),
  CONSTRAINT say_less_teams_member_ids_len CHECK (cardinality(member_ids) >= 2)
);

CREATE INDEX say_less_teams_session_id_idx ON public.say_less_teams (session_id);

CREATE TABLE public.say_less_previews (
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants (id) ON DELETE CASCADE,
  card_ids uuid[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, participant_id),
  CONSTRAINT say_less_previews_two_cards CHECK (cardinality(card_ids) = 2)
);

CREATE TABLE public.say_less_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  round smallint NOT NULL,
  team_id uuid NOT NULL REFERENCES public.say_less_teams (id) ON DELETE CASCADE,
  clue_giver_id uuid NOT NULL REFERENCES public.participants (id) ON DELETE RESTRICT,
  started_at timestamptz,
  ended_at timestamptz,
  end_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT say_less_turns_round_check CHECK (round IN (1, 2)),
  CONSTRAINT say_less_turns_end_reason_check CHECK (
    end_reason IS NULL
    OR end_reason IN ('timer', 'pile_empty', 'skipped', 'round_ended')
  )
);

CREATE INDEX say_less_turns_session_id_idx ON public.say_less_turns (session_id);

CREATE TABLE public.say_less_card_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turn_id uuid NOT NULL REFERENCES public.say_less_turns (id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.say_less_cards (id) ON DELETE RESTRICT,
  outcome text NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT say_less_card_events_outcome_check CHECK (
    outcome IN ('got_it', 'pass', 'oops', 'expired')
  )
);

CREATE INDEX say_less_card_events_turn_id_idx ON public.say_less_card_events (turn_id);

WITH pack AS (
  SELECT pack.id
  FROM public.content_packs pack
  JOIN public.protocols p ON p.id = pack.protocol_id
  WHERE p.slug = 'say-less' AND pack.slug = 'a'
)
INSERT INTO public.say_less_cards (content_pack_id, category, name, hint, sort_index)
SELECT pack.id, x.category, x.name, x.hint, x.sort_index
FROM pack,
(VALUES
  ('automotive-fleet', 'Henry Ford', 'Founder of Ford; popularized the moving assembly line', 1),
  ('automotive-fleet', 'Model T', 'Ford''s first mass-market car, 1908', 2),
  ('automotive-fleet', 'Ford F-150', 'Long-running best-selling US pickup; a fleet staple', 3),
  ('automotive-fleet', 'Volkswagen Beetle', 'Small, rounded German car nicknamed the Bug', 4),
  ('automotive-fleet', 'Jeep', 'Brand that started as a World War II military vehicle', 5),
  ('automotive-fleet', 'Indianapolis 500', 'Annual 500-mile race at the Brickyard', 6),
  ('automotive-fleet', 'Detroit', 'Motor City; home of the Big Three automakers', 7),
  ('automotive-fleet', 'Telematics', 'In-vehicle tracking of location, speed and driver behavior', 8),
  ('automotive-fleet', 'Total cost of ownership', 'Purchase, fuel, maintenance and resale over a vehicle''s life', 9),
  ('automotive-fleet', 'Upfitting', 'Adding equipment after purchase: shelving, racks, lights', 10),
  ('automotive-fleet', 'Fuel card', 'Company payment card drivers use at the pump', 11),
  ('automotive-fleet', 'Remarketing', 'Selling fleet vehicles at the end of their service life', 12),
  ('automotive-fleet', 'Lease', 'Paying to use a vehicle for a set term instead of buying it', 13),
  ('automotive-fleet', 'Recall', 'Manufacturer notice to fix a safety defect', 14),
  ('automotive-fleet', 'Depreciation', 'The value a vehicle loses as it ages', 15),
  ('life-sciences', 'Penicillin', 'First widely used antibiotic, found by Alexander Fleming in 1928', 1),
  ('life-sciences', 'Marie Curie', 'Won two Nobel Prizes; pioneered research on radioactivity', 2),
  ('life-sciences', 'DNA double helix', 'Twisted-ladder structure described by Watson and Crick in 1953', 3),
  ('life-sciences', 'Rosalind Franklin', 'Her X-ray image of DNA revealed its structure', 4),
  ('life-sciences', 'Louis Pasteur', 'Pasteurization; early rabies vaccine', 5),
  ('life-sciences', 'Jonas Salk', 'Developed the first effective polio vaccine', 6),
  ('life-sciences', 'Insulin', 'Hormone treatment for diabetes, first isolated in the 1920s', 7),
  ('life-sciences', 'Placebo', 'Inactive sugar pill used as a comparison', 8),
  ('life-sciences', 'Clinical trial', 'Testing a treatment in people, in phases', 9),
  ('life-sciences', 'FDA', 'US agency that approves drugs and medical devices', 10),
  ('life-sciences', 'mRNA vaccine', 'Technology behind the first COVID-19 vaccines', 11),
  ('life-sciences', 'CRISPR', 'Gene-editing tool, often called molecular scissors', 12),
  ('life-sciences', 'Dolly the sheep', 'First mammal cloned from an adult cell, 1996', 13),
  ('life-sciences', 'Petri dish', 'Shallow round lab dish for growing cultures', 14),
  ('life-sciences', 'Aspirin', 'Common pain reliever, originally derived from willow bark', 15),
  ('inventors', 'Thomas Edison', 'Phonograph, practical light bulb, Menlo Park', 1),
  ('inventors', 'Nikola Tesla', 'Alternating current; the car brand is named after him', 2),
  ('inventors', 'Wright brothers', 'First powered airplane flight, Kitty Hawk, 1903', 3),
  ('inventors', 'Alexander Graham Bell', 'Telephone', 4),
  ('inventors', 'Benjamin Franklin', 'Kite-and-key experiment; bifocals; on the $100 bill', 5),
  ('inventors', 'Leonardo da Vinci', 'Painted the Mona Lisa; sketched flying machines', 6),
  ('inventors', 'Ada Lovelace', 'Wrote what is considered the first computer program', 7),
  ('inventors', 'Grace Hopper', 'Navy admiral and computing pioneer; popularized "bug"', 8),
  ('inventors', 'Hedy Lamarr', 'Film star who co-invented frequency-hopping technology', 9),
  ('inventors', 'Johannes Gutenberg', 'Movable-type printing press', 10),
  ('inventors', 'Steve Jobs', 'Apple co-founder; the iPhone', 11),
  ('inventors', 'Tim Berners-Lee', 'Invented the World Wide Web', 12),
  ('inventors', 'James Dyson', 'Bagless vacuum cleaner', 13),
  ('inventors', 'Post-it Note', 'Sticky note born from 3M''s "failed" weak glue', 14),
  ('inventors', 'Velcro', 'Hook-and-loop fastener inspired by burrs stuck to a dog', 15),
  ('musicians', 'Elvis Presley', 'The King; Graceland', 1),
  ('musicians', 'The Beatles', 'Four-piece band from Liverpool', 2),
  ('musicians', 'Beyoncé', 'Former Destiny''s Child singer; Queen Bey', 3),
  ('musicians', 'Taylor Swift', 'The Eras Tour; fans called Swifties', 4),
  ('musicians', 'Dolly Parton', 'Country icon; Dollywood', 5),
  ('musicians', 'Mozart', 'Child-prodigy composer from Salzburg', 6),
  ('musicians', 'Beethoven', 'Composer who kept writing after losing his hearing', 7),
  ('musicians', 'Bruce Springsteen', 'The Boss; New Jersey', 8),
  ('musicians', 'Freddie Mercury', 'Lead singer of Queen', 9),
  ('musicians', 'Johnny Cash', 'The Man in Black', 10),
  ('musicians', 'Madonna', 'Queen of Pop', 11),
  ('musicians', 'Bob Marley', 'Reggae legend from Jamaica', 12),
  ('musicians', 'Elton John', 'Knighted British piano star with flamboyant glasses', 13),
  ('musicians', 'Aretha Franklin', 'Queen of Soul', 14),
  ('musicians', 'Frank Sinatra', 'Ol'' Blue Eyes; the Rat Pack', 15),
  ('movie-people', 'Tom Hanks', 'Forrest Gump; voice of Woody in Toy Story', 1),
  ('movie-people', 'Meryl Streep', 'Most Oscar-nominated actor ever', 2),
  ('movie-people', 'Steven Spielberg', 'Directed Jaws, E.T. and Jurassic Park', 3),
  ('movie-people', 'Alfred Hitchcock', 'Master of Suspense; Psycho', 4),
  ('movie-people', 'Marilyn Monroe', '1950s blonde icon; white dress over a subway grate', 5),
  ('movie-people', 'Charlie Chaplin', 'Silent-film tramp with a bowler hat and cane', 6),
  ('movie-people', 'Audrey Hepburn', 'Breakfast at Tiffany''s', 7),
  ('movie-people', 'Denzel Washington', 'Two-time Oscar winner; Training Day', 8),
  ('movie-people', 'Morgan Freeman', 'Famous narrator voice; played God in Bruce Almighty', 9),
  ('movie-people', 'Harrison Ford', 'Han Solo and Indiana Jones', 10),
  ('movie-people', 'Julia Roberts', 'Pretty Woman; Erin Brockovich', 11),
  ('movie-people', 'Clint Eastwood', 'Westerns; Dirty Harry', 12),
  ('movie-people', 'Judy Garland', 'Dorothy in The Wizard of Oz', 13),
  ('movie-people', 'Keanu Reeves', 'Neo in The Matrix; John Wick', 14),
  ('movie-people', 'Dwayne Johnson', '"The Rock"; wrestler turned action star', 15)
) AS x(category, name, hint, sort_index);

ALTER TABLE public.say_less_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.say_less_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.say_less_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.say_less_previews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.say_less_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.say_less_card_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.say_less_cards
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.say_less_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.say_less_teams
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.say_less_previews
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.say_less_turns
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.say_less_card_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);
