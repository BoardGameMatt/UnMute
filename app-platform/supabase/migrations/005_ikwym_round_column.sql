-- IKWYM: allow two GIF responses per participant (round 1 + round 2)

ALTER TABLE public.ikwym_responses
  ADD COLUMN round smallint NOT NULL DEFAULT 1;

ALTER TABLE public.ikwym_responses
  DROP CONSTRAINT ikwym_responses_session_participant_unique;

ALTER TABLE public.ikwym_responses
  ADD CONSTRAINT ikwym_responses_session_participant_round_unique
  UNIQUE (session_id, participant_id, round);
