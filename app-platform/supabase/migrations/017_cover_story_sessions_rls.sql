-- Lock cover_story_sessions to service_role (same as deals / guesses).
-- Phase and reveal clocks must not be writable via the anon client.

DROP POLICY IF EXISTS "Allow all for now" ON public.cover_story_sessions;

DROP POLICY IF EXISTS "Service role only" ON public.cover_story_sessions;

CREATE POLICY "Service role only" ON public.cover_story_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
