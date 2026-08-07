-- 011: Lower WAO round timer default from 90s to 60s.
-- Existing wao_sessions rows keep their stored timer_seconds; only new
-- sessions pick up the new default. Application writes use WAO_ROUND_SECONDS.

ALTER TABLE public.wao_sessions
  ALTER COLUMN timer_seconds SET DEFAULT 60;
