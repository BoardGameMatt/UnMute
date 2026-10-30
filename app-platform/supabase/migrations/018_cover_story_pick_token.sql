-- Private pick link for absentees / facilitator lock-on-behalf.

ALTER TABLE public.cover_story_deals
  ADD COLUMN IF NOT EXISTS pick_token text;

CREATE UNIQUE INDEX IF NOT EXISTS cover_story_deals_pick_token_unique_idx
  ON public.cover_story_deals (pick_token)
  WHERE pick_token IS NOT NULL;
