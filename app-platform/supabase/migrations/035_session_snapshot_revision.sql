-- A database-owned revision survives JSON resets and cannot be supplied by a
-- caller. Realtime payloads are notifications; snapshots use this watermark.
BEGIN;
ALTER TABLE public.session_state ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 0;
CREATE OR REPLACE FUNCTION public.bump_session_snapshot_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN NEW.revision := 0;
  ELSE NEW.revision := OLD.revision + 1; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS session_snapshot_revision ON public.session_state;
CREATE TRIGGER session_snapshot_revision BEFORE INSERT OR UPDATE ON public.session_state
FOR EACH ROW EXECUTE FUNCTION public.bump_session_snapshot_revision();
REVOKE ALL ON FUNCTION public.bump_session_snapshot_revision() FROM PUBLIC, anon, authenticated;
COMMIT;
