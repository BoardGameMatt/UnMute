-- Zoning Rights: protocol row, Pack A (121 buildings), live session tables.

INSERT INTO public.protocols (slug, name, description, type, min_players, max_players)
VALUES (
  'zoning-rights',
  'Zoning Rights',
  'Predict how a colleague would place buildings on a growing city map.',
  'turnbased',
  3,
  20
)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Buildings (single deck; opening cross is four random draws from this table)
-- ---------------------------------------------------------------------------

CREATE TABLE public.zoning_rights_buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_pack_id uuid NOT NULL REFERENCES public.content_packs (id) ON DELETE RESTRICT,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT zoning_rights_buildings_name_len CHECK (char_length(btrim(name)) > 0),
  CONSTRAINT zoning_rights_buildings_pack_name_unique UNIQUE (content_pack_id, name)
);

CREATE INDEX zoning_rights_buildings_pack_active_idx
  ON public.zoning_rights_buildings (content_pack_id, active);

-- ---------------------------------------------------------------------------
-- Live session
-- ---------------------------------------------------------------------------

CREATE TABLE public.zoning_rights_sessions (
  session_id uuid PRIMARY KEY REFERENCES public.sessions (id) ON DELETE CASCADE,
  phase text NOT NULL DEFAULT 'IND_PLANNER_PICK',
  mode text NOT NULL DEFAULT 'individual',
  individual_round_index integer NOT NULL DEFAULT 1,
  team_round_index integer NOT NULL DEFAULT 0,
  current_round_id uuid,
  board_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT zoning_rights_sessions_phase_check CHECK (
    phase IN (
      'IND_PLANNER_PICK',
      'IND_ZM_ASSIGN',
      'IND_GUESS',
      'IND_REVEAL',
      'TEAM_INTRO',
      'TEAM_PLANNER_PICK',
      'TEAM_ZM_ASSIGN',
      'TEAM_DISCUSS',
      'TEAM_LOCK',
      'TEAM_REVEAL',
      'SCOREBOARD'
    )
  ),
  CONSTRAINT zoning_rights_sessions_mode_check CHECK (mode IN ('individual', 'team')),
  CONSTRAINT zoning_rights_sessions_individual_round_check CHECK (individual_round_index >= 1),
  CONSTRAINT zoning_rights_sessions_team_round_check CHECK (team_round_index >= 0 AND team_round_index <= 3)
);

CREATE TABLE public.zoning_rights_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  mode text NOT NULL,
  round_index integer NOT NULL,
  planner_id uuid REFERENCES public.participants (id) ON DELETE RESTRICT,
  zm_id uuid REFERENCES public.participants (id) ON DELETE RESTRICT,
  lead_developer_id uuid REFERENCES public.participants (id) ON DELETE RESTRICT,
  k smallint NOT NULL,
  lots_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  building_ids uuid[] NOT NULL DEFAULT '{}',
  zm_assignment_json jsonb,
  team_guess_json jsonb,
  guess_started_at timestamptz,
  discuss_started_at timestamptz,
  intro_started_at timestamptz,
  ended_at timestamptz,
  end_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT zoning_rights_rounds_mode_check CHECK (mode IN ('individual', 'team')),
  CONSTRAINT zoning_rights_rounds_round_index_check CHECK (round_index >= 1),
  CONSTRAINT zoning_rights_rounds_k_check CHECK (k IN (3, 4)),
  CONSTRAINT zoning_rights_rounds_end_reason_check CHECK (
    end_reason IS NULL
    OR end_reason IN ('revealed', 'abandoned', 'timer', 'skipped')
  )
);

CREATE INDEX zoning_rights_rounds_session_id_idx ON public.zoning_rights_rounds (session_id);

ALTER TABLE public.zoning_rights_sessions
  ADD CONSTRAINT zoning_rights_sessions_current_round_fk
  FOREIGN KEY (current_round_id) REFERENCES public.zoning_rights_rounds (id) ON DELETE SET NULL;

CREATE TABLE public.zoning_rights_guesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.zoning_rights_rounds (id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants (id) ON DELETE CASCADE,
  assignment_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  locked_at timestamptz,
  is_exact boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT zoning_rights_guesses_round_participant_unique UNIQUE (round_id, participant_id)
);

CREATE INDEX zoning_rights_guesses_round_id_idx ON public.zoning_rights_guesses (round_id);

-- ---------------------------------------------------------------------------
-- Pack A + 121 buildings
-- ---------------------------------------------------------------------------

INSERT INTO public.content_packs (protocol_id, slug, label, subtitle, sort_order, status)
SELECT p.id, 'a', 'Pack A', '121 buildings, one deck', 1, 'active'
FROM public.protocols p
WHERE p.slug = 'zoning-rights'
ON CONFLICT (protocol_id, slug) DO NOTHING;

INSERT INTO public.zoning_rights_buildings (content_pack_id, name, active)
SELECT pack.id, n.name, true
FROM public.content_packs pack
JOIN public.protocols p ON p.id = pack.protocol_id
CROSS JOIN (
  SELECT unnest(ARRAY[
    'Post Office',
    'Castle',
    'School',
    'Nightclub',
    'Hot Dog Stand',
    'Stadium',
    'Bookstore',
    'Haunted Mansion',
    'Safe Injection Site',
    'Opera',
    'French Restaurant',
    'Rage Room',
    'Tax Service Center',
    'Buddhist Temple',
    'Exhibition Center',
    'Chocolate Factory',
    'Excavation Site',
    'Casino',
    'Aquarium',
    'Graffiti Tunnel',
    'Medieval Tavern',
    'Bakery',
    'Printing Shop',
    'Organic Supermarket',
    'Dry Cleaner',
    'Gas Station',
    'Distillery',
    'Outlet Mall',
    'Pharmacy',
    'College',
    'Community Garden',
    'Camp Ground',
    'Dog Park',
    'Yoga Retreat',
    'Bus Terminal',
    'Family Resource Center',
    'Bank',
    'Job Center',
    'Coffee',
    'Drive Through',
    'Mini Golf',
    'Visitor Center',
    'Thrift Shop',
    'Board Game Cafe',
    'Five Star Hotel',
    'Barbershop',
    'Gym',
    'Mermaid Pond',
    'Library',
    'Skyscraper',
    'Public Toilets',
    'Coal Mine',
    'Local Newspaper',
    'Condominiums',
    'Comedy Club',
    'Famous Statue',
    'Botanical Garden',
    'Public Housing',
    'Daycare',
    'Fancy Spa',
    'Youth Hostel',
    'Hourly Motel',
    'Dive Bar',
    'Animal Shelter',
    'Cemetery',
    'Retirement Home',
    'Skate Park',
    'Candy Shop',
    'Recycling Center',
    'Alien Abduction Site',
    'Synagogue',
    'Chinese Buffet',
    'Police Station',
    'Tattoo Parlor',
    'Business School',
    'Playground',
    'Co-working Space',
    'Mental Health Clinic',
    'Community Center',
    'Courthouse',
    'Karaoke Bar',
    'Arcade',
    'Massage Parlor',
    'Circus Park',
    'Art Gallery',
    'Movie Theatre',
    'Farmers Market',
    'Prison',
    'Production Studio',
    'Doomsday Bunker',
    'Baseball Field',
    'Jewelry Boutique',
    'Robot Factory',
    'Celebrity Residence',
    'Fire Station',
    'Modeling Agency',
    'Military Museum',
    'Gated Community',
    'Mosque',
    'Main Square',
    'Consulate',
    'Observatory',
    'Soap Factory',
    '5G Cell Tower',
    'Boxing Arena',
    'Alcoholics Anonymous',
    'Fish Shop',
    'Garage Sale',
    'Train Station',
    'Catacombs',
    'Ice Cream Truck',
    'Hospital',
    'Swimming Pool',
    'Pottery Studio',
    'Hardware Store',
    'Research Lab',
    'Church',
    'Intelligence Agency',
    'Cattle Ranch',
    'Amusement Park',
    'Nuclear Plant'
  ]) AS name
) n
WHERE p.slug = 'zoning-rights' AND pack.slug = 'a';

-- ---------------------------------------------------------------------------
-- RLS: service role only (play DTO strips zm_assignment)
-- ---------------------------------------------------------------------------

ALTER TABLE public.zoning_rights_buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoning_rights_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoning_rights_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoning_rights_guesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.zoning_rights_buildings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.zoning_rights_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.zoning_rights_rounds
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role only" ON public.zoning_rights_guesses
  FOR ALL TO service_role USING (true) WITH CHECK (true);
