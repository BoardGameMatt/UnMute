-- Unguessable host token for facilitator lead claim. Additive only:
-- keep designated_lead_name (stop reading it in app code; do not drop).
-- Keep session_participants_one_lead_per_session from migration 005.

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS host_token text;

-- Backfill existing sessions before enforcing NOT NULL.
UPDATE public.sessions
SET host_token = encode(gen_random_bytes(32), 'hex')
WHERE host_token IS NULL;

ALTER TABLE public.sessions
  ALTER COLUMN host_token SET DEFAULT encode(gen_random_bytes(32), 'hex');

ALTER TABLE public.sessions
  ALTER COLUMN host_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sessions_host_token_unique
  ON public.sessions (host_token);
