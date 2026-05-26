-- Draw It By Ear: image library + per-session teams

CREATE TABLE public.protocol_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_slug text NOT NULL,
  name text NOT NULL,
  image_path text NOT NULL,
  criteria jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX protocol_images_protocol_slug_idx ON public.protocol_images (protocol_slug);

ALTER TABLE public.protocol_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for now" ON public.protocol_images FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.dibe_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL,
  member_ids uuid[] NOT NULL DEFAULT '{}',
  describer_rotation uuid[] NOT NULL DEFAULT '{}',
  current_describer_index integer NOT NULL DEFAULT 0,
  cumulative_score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX dibe_teams_session_id_idx ON public.dibe_teams (session_id);

ALTER TABLE public.dibe_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for now" ON public.dibe_teams FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.protocol_images (protocol_slug, name, image_path, criteria) VALUES
('draw-it-by-ear', 'RoboDoc', 'RoboDoc.png', '[
  {"text": "The robot doctor has a headband", "points": 1},
  {"text": "Neither of the man''s feet are visible", "points": 1},
  {"text": "The robot dog has four wheels", "points": 1},
  {"text": "There is some hair on the man''s head", "points": 1},
  {"text": "The robot dog has both a tail and an antenna", "points": 1},
  {"text": "The robot dog is barking", "points": 2},
  {"text": "There is some hair on the man''s head", "points": 2},
  {"text": "The top of the needle is higher than the top of the robot doctor''s antenna", "points": 3},
  {"text": "One of the robot doctor''s eyes is bigger than the other", "points": 3},
  {"text": "Exactly one of the patient''s arms is visible", "points": 3}
]'),
('draw-it-by-ear', 'HatMan', 'HatMan.png', '[
  {"text": "Hat man has exactly 5 hats", "points": 1},
  {"text": "Hat man is wearing a bow tie", "points": 1},
  {"text": "Hat man is smiling", "points": 1},
  {"text": "The man''s nose is not visible", "points": 1},
  {"text": "The bottom of the leaf is the lowest item in the drawing", "points": 1},
  {"text": "There are 2 pockets on the man''s jacket", "points": 2},
  {"text": "There are exactly 3 buttons on the jacket", "points": 2},
  {"text": "The top of the stump is lower than the lowest button on the jacket", "points": 2},
  {"text": "There is spiral or circular wood grain on the tree stump", "points": 3},
  {"text": "The hats on his hands are higher than the hat on his head", "points": 3}
]'),
('draw-it-by-ear', 'Working Out', 'Working_Out.png', '[
  {"text": "All people are wearing shoes that have no laces", "points": 1},
  {"text": "There are two winged insects in the scene", "points": 1},
  {"text": "No more than 1 person has hair on their head", "points": 1},
  {"text": "The leftmost person in the scene is not holding anything", "points": 1},
  {"text": "The word Gym is closer to the top of the scene than any of the people", "points": 1},
  {"text": "None of the people have ears", "points": 2},
  {"text": "All of the people in the drawing have their hands above their noses", "points": 2},
  {"text": "At least one of the people is frowning", "points": 2},
  {"text": "One person is holding a barbell with weights that are below his waist", "points": 3},
  {"text": "There are exactly two drops of sweat next to but not touching one of the people''s heads", "points": 3}
]'),
('draw-it-by-ear', 'Dropping In For Lunch', 'Dropping_In_For_Lunch.png', '[
  {"text": "The bird is holding exactly 2 balloons", "points": 1},
  {"text": "The alligator is wearing sunglasses", "points": 1},
  {"text": "There is a straw in the cup", "points": 1},
  {"text": "The alligator is lying on a blanket", "points": 1},
  {"text": "The sun is to the right of the bird", "points": 1},
  {"text": "The alligator''s teeth are visible", "points": 2},
  {"text": "The bird''s mouth is open", "points": 2},
  {"text": "There are tears visible around the bird''s face", "points": 2},
  {"text": "There are stripes on the cup next to the alligator", "points": 3},
  {"text": "There are at least six rays emanating from the sun", "points": 3}
]'),
('draw-it-by-ear', 'Mountain Hike', 'Mountain_Hike.png', '[
  {"text": "The man has a hat on his head", "points": 1},
  {"text": "The man is facing to the left side of the drawing", "points": 1},
  {"text": "The man''s travel pack has a wheel visible on it", "points": 1},
  {"text": "There are at least two windows on the car", "points": 1},
  {"text": "The car has balloons for wheels with strings visible", "points": 1},
  {"text": "There are at least three stones in the scene", "points": 2},
  {"text": "The top of the car is higher than the top of the sun", "points": 2},
  {"text": "The man''s coat has at least one pocket", "points": 2},
  {"text": "The wheel on the travel pack is larger than the sun", "points": 3},
  {"text": "There are exactly five clouds in the sky", "points": 3}
]'),
('draw-it-by-ear', 'PastaToGo', 'PastaToGo.png', '[
  {"text": "The man''s pupils are not visible", "points": 1},
  {"text": "The man is wearing a bow tie", "points": 1},
  {"text": "Exactly one of the man''s ears is visible", "points": 1},
  {"text": "There is an upper case letter E in the scene", "points": 1},
  {"text": "The letter V is below the letter L", "points": 1},
  {"text": "There are at least four lines representing steam or heat rising from the pasta", "points": 2},
  {"text": "There are at least 3 coils in the telephone cord", "points": 2},
  {"text": "The bottle of wine is further to the left than the phone", "points": 2},
  {"text": "Pasta makes contact with the phone at a point that is above and to the right of the bowl", "points": 3},
  {"text": "At least four buttons are visible on the man''s coat", "points": 3}
]');
