# Known Limitations

These are defects, gaps, and structural risks. **None of this is intended
design.** Nothing here should be treated as a pattern to copy or preserve, with
one explicitly marked exception (the join code alphabet, item 12).

Items confirmed by reading the code are stated plainly with file and line.
Items that cannot be confirmed from the repository are marked "unverified, from
session history." Where behaviour is genuinely untested rather than known
broken, it is marked UNVERIFIED and paired with the test that would settle it.

## Authority boundary

`.cursorrules` is authoritative for the design system: colour and type tokens,
spacing, animation philosophy, and component styling patterns.
`docs/moment-contract.md` is authoritative for structure: session lifecycle,
actor model, state and timing, and cross-Moment continuity. This file is
authoritative for neither. It records where the code does not yet meet the
contract.

## 1. No event log. State is overwritten in place.

`session_state.state_json` is updated in place on every action. There is no
append-only history, so once a phase advances, the state that produced a bug is
gone and the bug cannot be diagnosed after the fact.

An append-only `session_events` table is the highest-value unbuilt item in the
system. Confirmed absent: the migrations define `persons`, `protocols`,
`teams`, `participants`, `team_roster`, `seasons`, `protocol_slots`,
`sessions`, `session_participants`, `session_state`, `session_feedback`,
`protocol_images`, and `dibe_teams`, and nothing else.

This cannot be backfilled. Every session played before the table exists is
permanently undiagnosable. That is the argument for building it before the next
round of client sessions, not after.

## 2. `session_state.phase` is unconstrained text

Defined as `phase text NOT NULL DEFAULT 'waiting'` in
`supabase/migrations/001_initial_schema.sql:149`, with no check constraint and
no enum. A typo in a phase string persists silently and the session parks on a
phase no client can render.

## 3. Reveal timing is min-across-clients, not server-authoritative

`lib/protocols/draw-it-by-ear/components/ImageRevealView.tsx` runs a
client-side `setTimeout` of `IMAGE_REVEAL_MS` (line 8) and every client posts
`advanceFromImageReveal` when its own timer fires. The earliest post wins and
the `armedPhase` guard turns the rest into no-ops, so the effective reveal
length is the minimum across all connected clients rather than the intended
value.

Practical consequence during a rolling deploy: a client still running an older
bundle posts on the older, shorter delay and truncates the reveal for everyone.
The durable fix is to move the reveal onto the server timer the way other timed
phases work.

## 4. Dropped actions fail silently

`sendAction` in `components/providers/SessionProvider.tsx:57` throws when the
response is not ok. Several call sites invoke it as a fire-and-forget promise,
for example `void sendAction("advanceFromImageReveal", ...)` in
`ImageRevealView.tsx`, so a failed action becomes an unhandled promise
rejection with no retry and no user-facing message. The participant sees a
screen that simply never advances.

The lead override controls are the exception: the action route returns
`{ changed: boolean }` and those controls surface a no-op to the lead. That
pattern is not applied to ordinary participant actions.

## 5. Local development and production share one Supabase project

Unverified, from session history. There is no second project and no
environment separation, so a destructive local operation reaches production
data. The seed script deletes rows.

## 6. Migrations are hand-applied, with no runner and no ledger

Migrations live as SQL files in `app-platform/supabase/migrations/` and are
applied by pasting them into the Supabase SQL editor. Confirmed absent from the
repository: any CI workflow directory, any Supabase CLI config
(`supabase/config.toml`), and any migration step in `package.json` scripts,
which contain only `dev`, `build`, `start`, `lint`, `seed`, and `test`.

Consequences: nothing records which migrations have been applied to which
project, and a deploy can ship code that depends on a migration nobody ran.

That a Vercel deploy runs `next build` and nothing else is unverified from the
repository, since Vercel project settings are not in the repo, but no migration
step exists in the repo for a deploy to run.

## 7. Hand-created sessions must include a `session_state` row

Session creation by hand-written SQL must insert **both** the `sessions` row
and its `session_state` row. Omitting the second produces a runtime failure
rather than a graceful empty state: the action route returns
`{"error": "session_state not found"}` with status 404
(`app/api/session/[id]/action/route.ts:125`).

The correct initial shape matches what the seed script writes: `current_round`
0, `phase` `'waiting'`, `state_json` `{}`.

## 8. `armedPhase` guard exists in only one Moment

The contract requires a phase-scoped `armedPhase` guard on every timer-expiry
handler (moment-contract 4.2). Draw It By Ear complies. The others do not.

Missing in The Truth Is, `lib/protocols/the-truth-is/engine.ts`:

- `onSubmissionTimerExpired` line 184
- `onDiscussionTimerExpired` line 372
- `onVotingTimerExpired` line 385
- `onLeaderboardTimerExpired` line 604

Missing in I Know What You Meme, which lives on branch `ikwym-v1` and not on
the default branch: `onGuessTimerExpired` line 277 of that branch's
`engine.ts`.

Neither action union carries a phase field, so the guard cannot be added at the
handler alone. The client payload, the mapper, and the union all need the field
first. This is the same defect class that consumed a scoring tier 139
milliseconds after it opened in Draw It By Ear.

## 9. Spectator path on late join exists in only one Moment

The contract requires that a late joiner lands in a spectator state
(moment-contract 2.2). Draw It By Ear implements it in
`lib/protocols/draw-it-by-ear/DrawItByEarProtocol.tsx`, which checks whether
the current participant appears in the engine's snapshotted roster and renders
a spectator screen when they do not.

`lib/protocols/the-truth-is/TheTruthIsProtocol.tsx` has no equivalent check.

TTI late-joiner behaviour is **UNVERIFIED**, not known broken. The test that
would settle it: start a TTI session with enough participants to initialize,
wait for the roster snapshot, then join that session with a new browser using
the join code and record exactly what renders. If it is an error, a blank
screen, or a crash, this becomes a defect. If it degrades sensibly, this item
closes.

## 10. Named duration constants are audited in only one Moment

The contract requires named duration constants with no inline literals
(moment-contract 4.4). Draw It By Ear is compliant and audited: the reveal
delay is the named `IMAGE_REVEAL_MS`, and no other `setTimeout` exists anywhere
in that Moment's tree.

The Truth Is and I Know What You Meme are **unaudited**. No claim of compliance
is made for either, in either direction.

## 11. Host token validation is looser than the schema guarantee

The schema guarantees 64 hex characters: `sessions.host_token` is `NOT NULL`,
defaults to `encode(gen_random_bytes(32), 'hex')`, and carries a unique index
(`supabase/migrations/006_session_host_token.sql`).

`lib/join/claim-host-lead.ts:20` validates only `hostToken.length < 32`, so a
32-character token passes application validation even though no such token
could have been issued by the database.

## 12. Join code alphabet lives only in Postgres. INTENTIONAL.

The unambiguous alphabet exists only inside the `generate_join_code()`
function, at `supabase/migrations/007_unambiguous_join_codes.sql:12`, as
`'ABCDEFGHJKMNPQRSTUVWXYZ23456789'`. There is no TypeScript equivalent.

`normalizeJoinCode` in `lib/constants.ts:21` deliberately accepts the wider
`A-Z0-9` set so that codes issued under the original 36-character alphabet in
migration 001 still resolve.

**This asymmetry is intentional. Do not "fix" it by narrowing
`normalizeJoinCode` to the new alphabet.** Doing so would invalidate every
join code issued before migration 007.

## 13. Cross-protocol coupling: a shared primitive lives inside one Moment

`lib/protocols/draw-it-by-ear/DrawItByEarProtocol.tsx:13` imports
`SessionIdentityBanner` from `lib/protocols/the-truth-is/`. A genuinely shared
primitive lives inside one Moment's folder, so changing or deleting it in The
Truth Is silently affects Draw It By Ear. Shared primitives belong in
`components/ui/`, where `TimerArc` and `SessionProgressBar` already live.

## 14. Duplicated minimum-participant floor

The same floor is encoded twice, with no shared constant:

- `MIN_PARTICIPANTS_TO_START = 3` at
  `components/session/session-lobby-view.tsx:15`, gating the Start button.
- An independent hardcoded 3-to-20 range check at
  `lib/protocols/draw-it-by-ear/engine.ts:497`, which throws.

Two sources of truth. Changing one does not change the other, and the failure
mode of divergence is a Start button that permits a count the engine rejects.

## 15. Branch `ikwym-v1` has diverged structurally, not just chronologically

I Know What You Meme is not on the default branch. It lacks the `armedPhase`
guard (item 8) and the spectator path (item 9), both of which post-date it.

Merging it as-is would import both known defect classes into the default
branch. It needs the guard and the spectator path added as part of the merge,
not after it.

## 16. Five `BackToLobbyLink` call sites still loop

`components/session/back-to-lobby-link.tsx` navigates to the lobby without
resetting `sessions.status`. Remaining call sites:

- `app/(site)/session/[session_id]/page.tsx` lines 80, 96, 117, and 139
- `lib/protocols/the-truth-is/TheTruthIsProtocol.tsx` line 89

What closes the loop: `app/(site)/session/[session_id]/lobby/page.tsx:48`
redirects back to `/session/[session_id]` whenever status is not `lobby`. So
each of these links returns the user to the screen they were trying to leave.
Draw It By Ear's usage was replaced with a lead-gated control that resets state
first. These five were not.
