-- Self-service join lets participants type their own name, and two people on a
-- team may legitimately share one (two Sarahs). Identity is the participant id,
-- not the name, so the uniqueness requirement is dropped. A plain index keeps
-- name lookups fast.

ALTER TABLE public.participants
  DROP CONSTRAINT IF EXISTS participants_team_display_name_unique;

CREATE INDEX IF NOT EXISTS participants_team_display_name_idx
  ON public.participants (team_id, display_name);
