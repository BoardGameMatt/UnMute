-- Cross-department pairing input for Wrong Answers Only (spec 5.4).
-- Department is per-engagement context, not a durable property of a person, so
-- the column goes on session_participants rather than participants.
--
-- Nullable, no default, no backfill. Spec 5.4 treats a null department as
-- unconstrained rather than a failed assignment, so null must stay a valid
-- state and must not be filled with a placeholder.
--
-- No CHECK constraint and no enum: department names are client-specific free
-- text and differ between engagements.

ALTER TABLE public.session_participants
  ADD COLUMN IF NOT EXISTS department text;

-- No index added. session_participants_session_participant_unique from 001
-- already indexes session_id as its leading column, which serves the only read
-- the pairing algorithm makes: one session's roster, tens of rows, grouped by
-- department in memory. See the notes for the reasoning.

-- RLS: no change required. The "Allow all for now" policy on
-- session_participants from 001 is FOR ALL USING (true) WITH CHECK (true).
-- Policies are row-scoped, not column-scoped, and there are no column-level
-- grants on this table, so the new column is covered as it stands.
