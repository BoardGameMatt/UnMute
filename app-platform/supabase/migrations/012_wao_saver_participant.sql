-- 012: Attribute WAO Save to the participant who declined a correct item.
-- had_save is retained; saver_participant_id names who held back.
-- References participants, matching wao_pairs / wao_taps in migration 008.
-- Existing rows keep null saver_participant_id (no backfill).

ALTER TABLE public.wao_round_results
  ADD COLUMN saver_participant_id uuid
  REFERENCES public.participants (id) ON DELETE RESTRICT;
