# Wrong Answers Only: schema notes

Companion to `app-platform/supabase/migrations/008_wrong_answers_only.sql`,
which is step 1 of Section 14 of the protocol spec. The migration has been
authored but **not applied**. Migrations in this repo are applied by hand in the
Supabase SQL editor, so nothing exists in the database yet.

Conventions followed from the existing migrations: sequential `NNN_` file
prefix, `uuid` primary keys defaulting to `gen_random_uuid()`,
`created_at timestamptz NOT NULL DEFAULT now()`, named constraints in the form
`<table>_<subject>_check` and `<table>_<subject>_unique`, indexes named
`<table>_<columns>_idx`, and RLS enabled on every table.

## The seven tables

**`wao_questions`** is the question library. One row per category question,
carrying the bold disambiguation rule, the optional detail line, how many of
the ten options are correct, difficulty, and region tag. `pinned` and `active`
drive runtime selection: random draw from active rows with pinned rows forced
into the rotation.

**`wao_question_items`** holds the ten options per question, one row each, with
`is_correct` as ground truth and `trap_tier` recording the gimme, graded, or
trap role the item plays. Two source URL and note pairs live here because the
spec requires two independent verifications per item. It is a row rather than
nested JSON so per-item elimination rates can accumulate across sessions and
self-calibrate difficulty.

**`wao_sessions`** is the protocol side of one platform session, joined to
`sessions` by foreign key. It stores the run configuration: timer length, how
many scored rounds, the follow-detection window, and the session Concurrence
Rate once computed. One row per platform session.

**`wao_rounds`** is one round inside a session, pointing at the question drawn
for it. `started_at` and `locked_at` bracket play, and `lock_reason` records
whether the round ended because both partners locked in or because the timer
expired. `is_sample` marks the unscored teaching round.

**`wao_pairs`** is one pairing inside one round. `participant_a` is always
present; `participant_b` is null exactly when `is_solo` is true, which covers
both the odd-headcount sit-out and a ghost partner. `locked_a_at` and
`locked_b_at` record the two Lock It In presses independently.

**`wao_taps`** is the append-only tap log and the source of server truth. Each
row is one participant asserting select or deselect on one item at a server
timestamp, with `client_seq` carrying the client's own ordering. Scoring, the
two selection sets, and the follow-rate derivation are all computed from this
table and never from client-reported state.

**`wao_round_results`** is the computed outcome for one pair in one round: the
submitted intersection as an array of item ids, the curve score, the Lock It In
bonus, the Left On The Table number, the Save flag, and whether the two
selection sets matched exactly. One row per pair, written server side at lock or
at the end of the settle window.

## Judgment calls

### Security and access

**1. RLS is two-tier rather than uniformly permissive.** Every other protocol
table in this repo uses `CREATE POLICY "Allow all for now" ... USING (true)`.
Following that for `wao_taps` would directly violate spec 7.2, which requires
that a participant with dev tools open cannot read another pair's selections,
and makes acceptance bar item 5 unpassable. So reference tables
(`wao_questions`, `wao_sessions`, `wao_rounds`) keep the permissive pattern, and
the four tables carrying the answer key or private pair state are restricted to
`service_role`.

**2. Restriction is by role, not by row predicate, because there is no
per-participant database identity.** Guest participants have `person_id` null
and are identified by the `unmute_participant_id` cookie, so `auth.uid()` is
null for them and no row-level predicate can distinguish one participant from
another. A predicate keyed on a request-scoped setting would require
application code to set it, which is out of scope for this step. Denying the
anon key outright is the only enforceable form of the guarantee available today,
and it fails closed rather than open.

**3. This creates a dependency for step 3 and later: WAO server code must use a
service-role Supabase client.** Both `lib/supabase/server.ts` and
`lib/supabase/client.ts` currently use `NEXT_PUBLIC_SUPABASE_ANON_KEY`, so
server code today has exactly the same privileges as the browser. Until a
service-role client exists, the four restricted tables are unreadable and
unwritable from anywhere in the app. This is deliberate: the alternative was
shipping tables that look protected and are not.

**4. `wao_question_items` is restricted even though the task only flagged taps
and pairs.** `is_correct` is the answer key, and the zero rule turns on it. A
client-readable copy ends the game before it starts, which is the same failure
class as the existing rule that DIBE images must never reach Drawer clients.
Items must reach participants through the server with `is_correct` withheld
until the reveal.

**5. `wao_round_results` is restricted too.** It carries per-pair scores and the
LOTT and Save flags, which are debrief content revealed on a schedule. Reading
another pair's result early is a smaller leak than the answer key, so this one
is closer to a preference than a requirement.

**6. Neither `wao_taps` nor `wao_pairs` is added to the `supabase_realtime`
publication.** Realtime `postgres_changes` respects RLS, so a table the anon key
cannot select from would deliver nothing anyway. The per-pair channel key in
spec 7.2, `wao:{round_id}:{pair_id}`, is consistent with server-authored
broadcast on that channel instead, which keeps pair isolation on the server
where the anon key cannot bypass it. If step 5 chooses `postgres_changes`
instead, it needs both a publication entry and a workable row predicate, which
returns to judgment call 2.

### Constraints the spec implied but did not state

**7. `correct_count` is not cross-checked against the number of items where
`is_correct` is true, and nothing enforces exactly ten items per question.**
Both need a trigger or a deferred constraint, which is more machinery than this
step should introduce. Both belong in the seed script's validation in step 1's
second half and in the library loader in step 13. Recording it here because a
question with nine items or a wrong `correct_count` will score incorrectly and
silently.

**8. `UNIQUE (question_id, label)` on items.** Two identical option labels in
one ten-item list is always an authoring error, and the four-state UI would
render them indistinguishably.

**9. `UNIQUE (wao_session_id, question_id)` on rounds** enforces spec 9.6, no
question repeats within a session, at the schema level rather than trusting the
draw logic.

**10. `UNIQUE (wao_session_id, round_number)`** prevents two rounds claiming the
same ordinal, which would make the round sequence ambiguous.

**11. `wao_pairs_solo_shape_check` couples `is_solo` and `participant_b`.**
Solo is true exactly when `participant_b` is null. Without this, a pair could
claim to be solo while holding two participants, or claim to be paired with one,
and the half-value scoring path would pick the wrong branch.

**12. `UNIQUE (round_id, participant_a)` is partial coverage, not full.** It
stops the same person appearing twice in the A slot of one round, but a person
could still appear as A in one pair and B in another. Expressing "each
participant appears at most once per round" across two columns needs an
exclusion constraint over a computed set, and the cross-round constraint from
spec 5.1, no repeat pairings within a session, needs unordered-pair uniqueness
across rounds. Both stay in the pairing algorithm in step 4, and both should be
asserted in its tests.

**13. `UNIQUE (pair_id, participant_id, client_seq)` on taps makes retries
idempotent.** Spec 7.3 has a tap retry twice before warning, and without a
dedupe key a retried tap that actually succeeded the first time inserts twice.
`client_seq` is therefore `NOT NULL`, so the key is always usable.

**14. `UNIQUE (pair_id)` on results** allows one result row per pair, so a
double-fired scoring pass conflicts rather than writing a second row and
double-counting on the leaderboard.

**15. `lott >= 0` is safe by construction**, since the LOTT set is a superset of
the submitted set and the curve is monotonic, so the difference cannot be
negative.

### Columns added beyond Section 6

**16. `created_at` on `wao_question_items`, `wao_rounds`, `wao_pairs`, and
`wao_round_results`.** Section 6 lists it only on some tables. Every table in
every existing migration has it, and matching that beat matching the spec
literally.

**17. `is_sample` on `wao_rounds`.** Section 4.1 has an unscored sample round,
and nothing in Section 6 distinguishes it. Without a flag it would land in the
leaderboard and the Concurrence Rate. The alternative was reserving
`round_number = 0` by convention, and an explicit boolean beats a magic number.
`round_number >= 0` allows either.

**18. `follow_window_seconds` on `wao_sessions`, default 8.** Spec 6.1 sets the
follow window at 8 seconds for v1 and says to store it as config. The session
row is where the rest of the run configuration lives.

**19. `relaxation_note` on `wao_pairs`.** Spec 5.2 requires logging every
constraint relaxation so the facilitator knows it happened. A dedicated
`wao_pairing_events` table would be the cleaner home, but this step is scoped to
exactly seven tables, and relaxation is a property of the assignment that
produced the pair.

**20. `wao_questions_active_idx`.** Not one of the four requested indexes.
Runtime selection filters on `active` on every draw, per spec 9.6.

### Types and deletion behaviour

**21. `concurrence_rate` is `numeric(5,2)` on a 0 to 100 scale, nullable.** The
spec says percentage, so it is stored as one rather than as a 0 to 1 fraction.
Null means not yet computed, which is distinct from a computed 0.

**22. `round_count` defaults to 4.** Spec 4.1 plans four scored rounds and
allows cutting to three inside a hard 15 minute envelope, so 4 is the intent and
3 is the fallback.

**23. `smallint` for `correct_count`, `difficulty`, and `round_number`;
`integer` elsewhere.** Follows the existing `rating smallint` with a range check
in `002_session_feedback.sql`.

**24. `participant_b` cascades on delete rather than setting null.** Setting
null would violate `wao_pairs_solo_shape_check` on a non-solo pair, so deleting
a participant would error instead of cleaning up. Cascade matches how
`session_feedback` treats participants.

**25. `question_id` on rounds and `item_id` on taps both use
`ON DELETE RESTRICT`.** Deleting a library question or option that a played
round or a logged tap refers to would destroy the record of what was played.
Restrict follows the precedent of `sessions.protocol_id`. Retiring a question
means setting `active` false, not deleting it.

**26. `submitted_item_ids` is `uuid[]`,** matching `dibe_teams.member_ids`
rather than introducing a join table for a set that is only ever read whole.

**27. `score` stores the awarded value, already halved for solo rounds.** No
separate pre-halving column, because the raw value is recomputable from
`wao_taps` and the pair's `is_solo` flag at any time.

## Step 2: the question library file and its validator

`app-platform/supabase/seed-data/wao-questions.json` is the versioned source of
truth for the library, per spec 6.2. Its shape maps one to one onto the two
library tables: the top level carries `schema_version` and `protocol`, then a
`questions` array whose objects hold exactly the columns of `wao_questions`
minus `id` and `created_at`, plus an `items` array whose objects hold exactly
the columns of `wao_question_items` minus `id`, `question_id`, and `created_at`.
Every question carries exactly ten items.

```json
{
  "schema_version": 1,
  "protocol": "wrong-answers-only",
  "questions": [
    {
      "category_title": "Real IKEA product names",
      "disambiguation_rule": "A name IKEA has actually used for a product.",
      "disambiguation_detail": "Invented Swedish-sounding words do not count...",
      "correct_count": 4,
      "difficulty": 2,
      "region_tag": "global",
      "pinned": false,
      "active": false,
      "items": [
        {
          "label": "BILLY",
          "is_correct": true,
          "trap_tier": "gimme",
          "source_1_url": null,
          "source_1_note": null,
          "source_2_url": null,
          "source_2_note": null
        }
      ]
    }
  ]
}
```

The three questions in the file are test content for building against, not
library content. All three are `active: false` with all four source fields null,
which is what an unverified question is supposed to look like. **No source URLs
were invented.** Two-source verification is the control the whole library rests
on, so a fabricated citation would be worse than no citation. The `is_correct`
values are authoring assertions and are equally unverified; the verification
workstream settles them, and until it does, `active: false` keeps them out of
the runtime draw.

### Running the validator

From `app-platform`:

```bash
npm run validate:wao                              # validates the default file
npx tsx scripts/validate-wao-questions.ts <path>  # validates any other file
```

It reads JSON, prints one `FAIL` line per violation naming the question and,
where the violation belongs to an item, the item label, then exits 1. On a clean
file it prints the question count and exits 0. It opens no network or database
connection, reads no environment, and writes nothing.

Rejections: not exactly ten items; `correct_count` not equal to the number of
items marked `is_correct`; `correct_count` outside 1 to 5; fewer than two
`gimme` items or fewer than two `trap` items; duplicate labels within a
question; missing or empty `disambiguation_rule`; `region_tag`, `trap_tier`, or
`difficulty` outside their allowed values; and `active: true` while any item has
a null `source_1_url` or `source_2_url`.

### Judgment calls in step 2

**28. Category choice was driven by spec 9.1 rule 1, not by the slate order.**
Real IKEA product names, airport code and city pairings, and English words
borrowed directly from Dutch each require ten independent lookups. Several
entries on the 9.5 slate do not survive rule 1 read strictly: Pokémon resolve
from the National Pokédex, countries that drive on the left, elements named
after places, and languages above ten million speakers each resolve from one
Wikipedia table. Those are noted here rather than acted on, because pruning the
slate is a content-workstream decision.

**29. The two extra validations the brief did not list.** The validator also
rejects a `disambiguation_rule` longer than 140 characters and duplicate
`category_title` values across the file. Both would fail at insert time against
008 (`wao_questions_disambiguation_rule_len`, and the natural key the loader
will need), and catching them in the validator is cheaper than catching them in
Postgres.

**30. Labels are compared case-insensitively and trimmed for the duplicate
check.** The database constraint `UNIQUE (question_id, label)` is exact-match,
so `"Waffle"` and `"waffle"` would both insert. Two options a participant reads
as identical is the authoring error judgment call 8 was written about, so the
validator is deliberately stricter than the constraint.

**31. No `id` or slug field in the JSON.** Adding one would have broken the one
to one mapping onto the tables, so `category_title` is the natural key, which is
why duplicate titles are a failure. If the loader in step 13 needs stable
identity across re-seeds, that is the field to add, with `schema_version` going
to 2.

**32. `schema_version` is an integer, not a semver string.** It exists to let a
loader refuse a file it does not understand, which needs an ordered comparison
and nothing more.

**33. The validator is TypeScript in `app-platform/scripts/` run through `tsx`,
matching `seed.ts`.** It adds a `validate:wao` entry to `package.json` scripts
alongside `seed`, which is the only file outside the two new ones this step
touched.

**34. Structural type errors are reported as failures rather than thrown.**
A file with a missing field or a string where a boolean belongs reports every
problem in one pass instead of stopping at the first, since the point of the
tool is to fix a whole authoring batch in one sitting.

## Blocked dependency, not a judgment call

Spec 5.4 requires a `department` field on the participant record to drive
cross-department pairing. That means altering `public.participants`, which this
step is explicitly forbidden from touching, so no such column exists yet. The
pairing algorithm in step 4 cannot honour the cross-department preference until
a later migration adds it. Spec 5.4 already says a null department should be
treated as unconstrained rather than failing the assignment, so step 4 can be
built and tested against that degenerate case first.

Resolved by migration 009, described in the next section, which puts the column
on `session_participants` instead of `participants`.

## Migration 009: department on session_participants

`app-platform/supabase/migrations/009_session_participant_department.sql` adds a
single nullable `department text` column to `public.session_participants`. Like
008 it has been authored but **not applied**. It is the only change to an
existing table either step makes.

**`session_participants`, not `participants`.** Department is per-engagement
context rather than a durable property of a person: the same person can sit in
different org contexts across clients, and a `participants` row is a person's
membership on one team. `session_participants` is also the table the pairing
algorithm reads, since it is the session roster, so the department arrives on
the same row as the participant it describes with no extra join. Blast radius
decided it: `participants` is referenced by 001, 002, 003, and 008, while
`session_participants` is referenced by nothing outside 001 and the lead index
in 005. Note that `wao_pairs` still references `participants.id`, so step 4
reads the roster once, maps `participant_id` to `department`, and keeps writing
`participants` ids into the pair rows.

**RLS finding: nothing needs updating.** `session_participants` carries the
`"Allow all for now"` policy from 001, `FOR ALL USING (true) WITH CHECK (true)`.
Postgres RLS policies are row-scoped, never column-scoped, and no migration
issues column-level `GRANT`s on this table, so a newly added column inherits the
existing policy with no further statement. The same applies to the
`supabase_realtime` publication: 001 publishes the whole table, and a publication
without a column list publishes whole rows, so `department` reaches subscribers
automatically.

### Judgment calls in migration 009

**35. No index on `(session_id, department)`.** The unique constraint
`session_participants_session_participant_unique` from 001 already provides a
btree index with `session_id` leading, which fully serves the pairing read of
one session's roster. A session is tens of rows at most, so Postgres would
sequential-scan the filtered set regardless, and a second index would cost write
overhead on every join and connection update for no read benefit. Adding one
becomes worth revisiting only if department is ever queried across sessions.

**36. Nullable with no default and no backfill.** Every existing row stays null,
which is the state spec 5.4 defines as unconstrained. A placeholder such as
`'unknown'` would be worse than null, because the pairing algorithm would read
it as a real department and try to pair across it, making every unlabelled
participant look like one large department to the cross-department preference.

**37. No normalization of the value, and none enforced.** Free text means
`Engineering`, `engineering`, and `Engineering ` are three distinct departments
to a naive comparison. No `CHECK`, trigger, or `citext` type is imposed, per the
brief, so step 4 must trim and casefold before comparing, and the eventual
capture UI should offer the session's existing values rather than a blank field.
Recording it because the failure is silent: pairing would simply stop preferring
cross-department without erroring.

**38. The column has no writer yet.** Nothing in the app populates it, so until a
later step adds capture, every row is null and the pairing algorithm runs in the
degenerate unconstrained mode spec 5.4 describes. `lib/types/database.ts` also
does not know the column yet; regenerating or hand-editing it belongs to the
step that writes the first query against it, since this step is limited to
schema.

## Service-role access for WAO server code

Judgment call 3 restricts `wao_questions`, `wao_question_items`, `wao_pairs`,
`wao_taps`, and `wao_round_results` to `service_role`, so every WAO server read
and write has to go through a service-role client. **No new module was created,
because one already existed:** `app-platform/lib/supabase/admin.ts` exports
`createServiceClient()`, built on `createClient<Database>` with
`SUPABASE_SERVICE_ROLE_KEY` and a throw when the URL or key is missing. WAO
server code uses that. A second service-role module would have meant two doors
to the same RLS-bypassing key and two places to keep a guard in sync.

What was missing was the guard, and the key was undocumented. Both are fixed:

**The guard is two layers, in `admin.ts`.** `import "server-only"` fails the
build if any client component imports the module, and a module-scope
`typeof window !== "undefined"` throw is the runtime backstop. `server-only` was
not previously a dependency; it is now, at `^0.0.1`, zero-dependency and the
mechanism Next.js documents for this. Verified by temporarily adding a
`"use client"` page that imports `createServiceClient`: `next build` failed with
`You're importing a component that needs server-only`, pointing at line 2 of
`admin.ts`. The temporary page was deleted and the build passes clean.

**`SUPABASE_SERVICE_ROLE_KEY` is now in `.env.local.example`**, with a comment
that it bypasses RLS entirely, must never reach the browser, and must never take
a `NEXT_PUBLIC_` prefix. No key value is committed anywhere; `.env.local` holds
the real value and is gitignored by both `.gitignore` files.

**Import audit, as of this step: clean.** The only importer of
`lib/supabase/admin` anywhere in the repo is
`app/api/dibe/image/[sessionId]/route.ts`, a route handler with no `"use client"`
directive. No client component, shared module, page, or layout reaches it
transitively. The `server-only` import means this stays true by construction
rather than by audit.

### FK teardown ordering

The `ON DELETE RESTRICT` references in 008 mean deletion order now matters, and
getting it wrong throws a foreign key violation rather than cleaning up quietly.
Any WAO cleanup — a seed teardown in the shape of the `cleanupDemoData` function
in `scripts/seed.ts`, a test fixture reset, or a manual purge — must delete in
this order:

1. `wao_taps`
2. `wao_round_results`
3. `wao_pairs`
4. `wao_rounds`
5. `wao_sessions`

and only then touch `participants`. `wao_pairs.participant_a` and
`participant_b` both `RESTRICT` against `participants`, and `wao_taps.item_id`
and `wao_rounds.question_id` `RESTRICT` against the library tables, so deleting a
participant who has played, or a question that has been drawn, fails until the
protocol rows are gone. Deleting the platform `sessions` row still cascades to
`wao_sessions`, `wao_rounds`, and `wao_pairs`, which is the easy path when the
whole session is going away, but it does not help when only a participant is
being removed.

### Judgment calls in this step

**39. Hardening the existing client rather than adding a WAO-specific one.**
The brief asked for a new module alongside `server.ts` on the premise that no
service-role client existed. One did. Duplicating it would have left the
original unguarded while adding a second copy to maintain, so the guard went on
`admin.ts` instead. This is the only edit to an existing module in the step and
it changes no caller: `createServiceClient` keeps its name, signature, and
behaviour.

**40. Both guard layers, not one.** `server-only` is the stronger of the two,
because it fails at build time and the mistake never ships. It is also a
bundler-condition mechanism, so it does nothing for code paths outside the Next
build, such as a `tsx` script importing the module. The `typeof window` throw
costs one branch at module load and covers that gap.

**41. `lib/supabase/server.ts` was left alone.** It still creates a cookie-aware
anon client through `@supabase/ssr`, which remains correct for everything
outside the WAO tables. The two clients are not interchangeable: `server.ts`
carries the participant's cookie session and is subject to RLS, `admin.ts`
carries neither and bypasses RLS, so WAO server code must authorize the caller
itself before using the service client. Nothing in this step enforces that; it
is a rule for whoever writes the first WAO route.

## Pairing algorithm

`app-platform/lib/wao/assign-pairs.ts` exports `assignPairs(participantIds,
history)`, a pure function with no I/O and no randomness. The caller passes
history; the function never reads or writes Supabase. Re-exported from
`lib/wao/index.ts`. Tests live in `assign-pairs.test.ts` and run under the
repo's existing `tsx --test` / `node:test` setup (`npm test`).

### Result shape

```ts
type RoundAssignment =
  | { ok: true; pairs: AssignedPair[]; sitOut: string | null }
  | { ok: false; reason: string };
```

Success covers the roster exactly: every id appears once, either in a pair or
as `sitOut`. `sitOut` is null when headcount is even. Failure is an explicit
discriminated result, never a throw. The `reason` string is meant to be
surfaced to the facilitator when regeneration fails.

### Constraints (spec §17; §5.2 relaxation withdrawn)

1. No repeat pairings within the session. Hard.
2. Even sit-out distribution: nobody sits out twice until everyone has sat out
   once (spec §3.6).

There is no cross-department constraint and no department argument. Section 17
withdrew both. If no assignment satisfies the two constraints, the function
returns `{ ok: false, reason }` rather than relaxing anything.

### How it works

Pairings are unordered. `pairKey(a, b)` sorts the two ids so `{A,B}` and
`{B,A}` collide. History stores raw pairs; the forbidden set is built from
those keys before search.

Even headcount: backtracking perfect matching on the full roster, trying
partners in input order, skipping forbidden edges.

Odd headcount: eligible sit-outs are everyone at the current minimum sit-out
count (input order preserved). For each candidate, try a perfect matching on
the remaining even set. First success wins.

### Determinism

No randomness and no seed parameter. Candidates are always tried in the order
of the `participantIds` array the caller passed. Same roster order and same
history always produce the same assignment (or the same failure). A seed would
only be needed if the search shuffled; it does not.

### Judgment calls

**42. Module lives at `lib/wao/`, not under `lib/protocols/`.** The brief asked
for `lib/wao/`. Pairing is protocol logic but has no React surface yet, and
keeping it out of the protocol component tree makes the pure-function boundary
obvious. A later step can re-export from a protocol package if needed.

**43. History is flat `{ pairs, sitOuts }`, not per-round.** The algorithm only
needs the set of used edges and the sit-out multiset. Round numbers belong to
persistence (`wao_rounds`), not to the pure function. The caller that writes
`wao_pairs` is responsible for assembling history from prior rows.

**44. Within a returned pair, `participantA` is the one that appears earlier in
the input roster.** Matches the schema convention that `participant_a` is
always present and makes golden tests stable. The no-repeat check does not
depend on this order.

**45. Empty roster fails; one participant succeeds as a solo sit-out.** Zero is
an explicit failure so a caller that forgot to load the roster cannot invent
an empty round. One person has nowhere to pair, so they are the sit-out; once
they have sat out, "everyone has sat out once" is true and they may sit out
again. That matches §3.6 read for the degenerate roster rather than inventing
a special case that throws.

**46. Four participants exhaust after three rounds.** K₄ has exactly three
perfect matchings. The fourth call returns failure. That is the acceptance
case for "surface to the facilitator rather than relax," and it is covered by
test. Two participants fail on the second round for the same reason.

**47. Duplicate ids in the input are collapsed, first occurrence kept.** A
defensive guard so a buggy caller cannot turn an even roster odd by repeating
an id. Not a substitute for fixing the caller.

**48. Departed participants in history are ignored for sit-out counts and only
block a pair when both members are still candidates.** Sit-out counts are
tallied only for the current roster, so a new joiner starts at zero and is
preferred. A historical pair involving someone who left cannot be re-formed
anyway and does not need special handling beyond the forbidden-edge check on
the remaining graph.

## Selection state, pair Realtime, and four-state UI

Step 7 of the build: one round of play for a pair that already exists. No
scoring, reveal, facilitator screen, question drawing, or round advancement.

### Modules

| Path | Role |
|---|---|
| `lib/wao/authorize-pair.ts` | Section 16 gate. `authorizePairMember(pairId)` and `authorizeSessionParticipant(sessionId)`. |
| `lib/wao/reduce-taps.ts` | Pure reduction of `wao_taps` → two selection sets. |
| `lib/wao/build-pair-state.ts` | Public play payload; strips `is_correct`. |
| `lib/wao/broadcast.ts` | Server `httpSend` onto `wao:{round_id}:{pair_id}`. |
| `lib/wao/use-wao-pair-play.ts` | Client hook: optimistic taps, ack/retry, channel, timer settle. |
| `lib/protocols/wrong-answers-only/` | Registered protocol shell + four-state UI. |
| `app/api/wao/pair/[pairId]/{tap,lock,state,close-timer}` | Pair-scoped routes. |
| `app/api/wao/session/[sessionId]/play` | Discover the caller's current pair. |

### Authorization helper

`authorizePairMember` is the only gate. Cookie identity first, then service
client to load the pair (RLS leaves no other option), immediate pair-membership
check, then round → wao_session → `session_participants` via the anon server
client. On success it returns `{ participantId, pair, round, waoSession, admin }`.
Routes use `auth.admin` and never call `createServiceClient()` themselves.

`authorizeSessionParticipant` is the session-scoped twin for discovery: cookie
+ membership on the anon client, then service client only after that passes.

### Tie-break rule

Tap reduction sorts by:

1. `created_at` ascending (server timestamp only — never client-supplied)
2. `client_seq` ascending
3. `participant_id`, then `item_id`

`client_seq` is unique per `(pair_id, participant_id)`, so two partners can
share a timestamp and a seq value; the id tie-break keeps the total order
stable across processes. Same inputs always produce the same sets.

### Retry behaviour

Optimistic local update → `POST /tap` with `clientSeq` → ack replaces confirmed
sets. On failure, retry twice with backoff (300ms, 600ms). The unique constraint
on `(pair_id, participant_id, client_seq)` makes a successful retry after a
lost response idempotent (`23505` → treat as ack). After two failed retries, a
non-blocking warning appears and state is refetched. Unconfirmed items show a
steel-blue sync dot.

### Realtime note

Broadcast channels are **not RLS-protected**. The channel name embeds
`pair_id`, which therefore functions as a capability token. No participant
client may ever receive another pair's `pair_id`. State and play payloads only
return the caller's own pair. Do not switch this to `postgres_changes` on
`wao_taps` — anon cannot read that table.

### Judgment calls

**49. `close-timer` is a fourth route.** The brief listed tap, lock, and state.
Timer close needs a server-authoritative write after the settle window; folding
it into lock would blur Lock It In (bonus-eligible, both-locked) with timer
expiry. Separate route, same auth helper.

**50. Amber only on Lock It In and the final-15s timer stroke.** The persistent
norm uses steel-blue, not amber. `WaoPlayTimer` hardcodes `#F5A623` /
`#1B3A5C` for SVG strokes the same way `TimerArc` already does — SVG attributes
cannot take Tailwind tokens.

**51. Service client returned untyped.** `createClient<Database>` from
`@supabase/supabase-js` requires Row shapes to satisfy `Record<string, unknown>`.
This repo's `Database` uses interfaces, which do not, so Schema collapses to
`never` and every insert is a type error. The SSR anon client already falls
back to `any`. `createServiceClient` now returns plain `SupabaseClient`. WAO
table interfaces still live in `database.ts` for documentation and manual casts.
Converting every Row to a type alias is a separate cleanup.

**52. Protocol registers and renders a waiting state when no pair exists.**
Round creation is out of scope, so the shell discovers via `/play` and shows
"Waiting for the round" until a pair row exists for this participant.

**53. Taps accepted until `locked_at` is set.** Client disables input at T=0;
server still accepts taps during the 3s settle so in-flight requests land.
`close-timer` requires `now >= started_at + timer_seconds + 3`.

**54. Solo lock closes the round when `locked_a_at` is set.** Matches
`is_solo` shape; no partner to wait for.

## Round setup

The missing piece between join and play: a facilitator action that creates
`wao_session` / `wao_round` / `wao_pairs` so `GET .../play` and `WaoPlayView`
have something to load.

### Path

`POST /api/wao/session/[sessionId]/start-round` → `startWaoRound` in
`lib/wao/start-round.ts`:

1. Create `wao_sessions` if absent (`timer_seconds: 90`).
2. Refuse with 409 if any round in that session still has `locked_at` null.
3. Draw a question (`lib/wao/draw-question.ts`): unused pinned first, else
   ascending difficulty band, random within the band; no repeats in-session
   (spec §9.6).
4. Insert `wao_rounds` with `started_at` set now, `is_sample: false`.
5. Load roster from `session_participants` (joined_at order), build pairing
   history from prior `wao_pairs`, call `assignPairs`, insert pair rows
   (including solo sit-out).

Lead UI: on the waiting screen, **Start round** calls this route then reloads
play state. Members poll `/play` every 3s while waiting. `/play` prefers an
unlocked round so a just-started round wins over a locked prior.

### Authorization

`authorizeSessionLead` — same pattern as lobby `requireLead` and the DIBE
lead check on `POST /api/session/[id]/action`: `PARTICIPANT_COOKIE` must
identify a `session_participants` row with `role_in_session === "lead"`.
Not `authorizePairMember` (no pair exists yet). Participant routes are
unchanged and still require the pair helper.

### Inactive question gate

The three seed questions are `active: false`. Drawing them requires **both**:

1. Request body `{ "includeInactive": true }`
2. `NODE_ENV !== "production"`

Production ignores the flag (and returns 400 if it is sent). The lead Start
button only sends `includeInactive: true` when the client bundle is not
production. Active-only remains the default path.

### Judgment calls

**55. Round numbers start at 1**, not 0. Sample rounds are out of scope; using
1 keeps `round_number >= 0` happy and leaves 0 free for a future sample.

**56. Open-round conflict is a hard 409**, not regenerate. Spec 5.5 allows
regeneration before play; this step does not, so a stuck open round must be
locked or deleted by hand before another start.

**57. Lead is included in the roster.** `session_participants` is the whole
room; the lead plays. Sit-out rotation treats them like anyone else.

**58. Pair-insert failure rolls back the round row** so a retry does not leave
an orphan round with no pairs. Not transactional across tables without a DB
function; best-effort delete is enough for v1.
