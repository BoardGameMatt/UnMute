-- Unambiguous join codes for new sessions.
-- Excludes 0/O and 1/I/L which are routinely misread.
-- Length stays 6. Existing join_code values are untouched and remain valid.

CREATE OR REPLACE FUNCTION public.generate_join_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  -- 31 chars: A–Z and 2–9 minus O, I, L
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := '';
  i integer;
  idx integer;
BEGIN
  FOR i IN 1..6 LOOP
    idx := floor(random() * length(alphabet))::integer + 1;
    result := result || substr(alphabet, idx, 1);
  END LOOP;
  RETURN result;
END;
$$;
