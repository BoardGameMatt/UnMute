-- Designate a facilitator by display name before anyone joins.
-- NULL keeps the first-joiner fallback for existing sessions.
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS designated_lead_name text;

-- At most one lead per session. Closes the double-first-joiner race:
-- the second concurrent insert as lead fails and is retried as member.
CREATE UNIQUE INDEX IF NOT EXISTS session_participants_one_lead_per_session
  ON public.session_participants (session_id)
  WHERE role_in_session = 'lead';
