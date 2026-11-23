# Workshop reliability harness

Current extension: [all remaining implemented protocols](../../docs/remaining-protocol-reliability-results.md).
The earlier counts and limited protocol scope below describe the previous batch.

The contract is [`../../docs/workshop-reliability.md`](../../docs/workshop-reliability.md).
Tests assert desired workshop behavior. A failure is a reproduced weakness, not
an expected-to-fail test disguised as a pass. The assertions preserve existing
game mechanics while the application execution paths are repaired.

## Run

Use **Node 24** for this harness (validated with 24.12.0). It uses Node's native
TypeScript stripping, synchronous module hooks, and test clock. This requirement
is for the test runner; it does not change the app's deployment runtime.
Install the locked dev dependencies with `npm ci` (allow the native PostgreSQL
package's install script). The full suite creates its own PostgreSQL server;
no credentials, existing database, running app, or production environment are used.

```powershell
cd app-platform
npm run test:reliability
```

The command exits nonzero while any reliability contract is violated. For the
test infrastructure checks alone:

```powershell
npm run test:reliability:harness
```

Run only native PostgreSQL checks with `npm run test:reliability:postgres`, or
the database-free checks with `npm run test:reliability:local`. The native server
binds to loopback on a temporary port and stops/removes its fresh cluster after
the run. No existing database URL is accepted. On Linux use a normal non-root
account; the runner does not create system users or install a database service.

Filter a scenario while investigating a fix:

```powershell
node --test --test-name-pattern="R2 DIBE" tests/reliability/workshop.test.mjs
```

The full run is required for a result summary; a filtered run omits other cases.
Node may print a module-type detection warning for existing application `.ts`
files. Do not change the app's package module type merely to suppress it.

## How it works

- `runtime.mjs` resolves application aliases and replaces only Next response/
  cookie infrastructure, the Supabase client factories, and `server-only`.
  Application handlers, stores, authorization helpers, engines, and broadcast
  helpers execute unchanged. Unexpected HTTP requests throw immediately.
- `database.mjs` implements the small PostgREST subset these scenarios use. Each
  query has an isolated snapshot. Barriers force known request interleavings;
  injected failures happen before writes. Explicit unique keys model WAO tap
  deduplication. Storage trace and captured broadcasts are inspectable in a test.
- `workshop.test.mjs` supplies deterministic clocks and fixtures. Faults and
  scheduling are controlled by tests, without editing production source or
  relying on timing sleeps. Tests run sequentially within the scenario process
  because its cookie/database context is intentionally shared.
- `database.test.mjs` verifies that the fixture itself preserves read snapshots,
  enforces declared uniqueness, and does not mutate rows on an injected failure.
- `transactions.test.mjs` runs the actual SwitchCode/Say Less coordinators against
  native PostgreSQL through `postgres.mjs`. That transport translates the small
  query-builder subset into parameterized SQL and invokes the migration's real
  functions. Test-only AFTER triggers inject write failures inside transactions.
  No RPC decision, transaction, lock, constraint, or rollback is simulated.

The double does **not** implement Postgres transactions, RPCs, triggers, foreign
keys, RLS, real joins, selected-column projection, or Realtime delivery. Nested
join data is fixture data. Only explicitly configured unique keys are checked.
It must not be used as evidence that database migrations or transactions work.
Unsupported tables/methods fail instead of returning invented success. If a fix
introduces an RPC, exercise that RPC against disposable real Postgres rather than
stubbing it to return success. API responses use native Response rather than
starting a Next server; HTTP transport and browser hooks are not exercised.

The native test cluster applies the actual dependency migrations 001, 019, 025,
032–036 from scratch, with a minimal Supabase auth/role/publication bootstrap.
It is a real PostgreSQL server, not PGlite or an in-memory SQL emulator. It is
not the full Supabase stack: PostgREST HTTP, Auth, Realtime delivery, all other
protocol migrations, and the deployed production schema remain separate checks.

## Baseline: 2026-10-29

Full run on the supplied checkout: **13 checks, 6 pass, 7 fail**. Four passing
checks validate the harness, two validate application behavior. All seven failures
are contract assertion failures, not fixture/import errors.

| Contract | Scenario | Baseline |
| --- | --- | --- |
| R2 | DIBE: simultaneous scoring requests read the same snapshot; both acknowledged submissions must survive | FAIL: one is overwritten |
| R2 | DIBE: delayed no-op arrives after a session-length choice | FAIL: newer choice erased |
| R4 | DIBE: expiry arrives immediately after a 90-second description begins | FAIL: phase advances |
| R1 | WAO: identical request retried after its acknowledgement is discarded | PASS: one stored tap |
| R1 | WAO: reload restarts sequence; next tap has different content | FAIL: success without storing the requested input |
| R4 | WAO: input arrives long after deadline/settle, with no close request | FAIL: input accepted |
| R4 | WAO: input arrives after persisted round lock | PASS: rejected without writing |
| R3 | SwitchCode: storage fails while writing the next phase's required data | FAIL: guessing phase without a timer |
| R3/R8 | Say Less: all score-event write retries fail after a correct card | FAIL: card removed without its point |

This baseline is a diagnostic register, not an allowance to leave failures in a
release. Fix the application, retain the behavioral assertion, and update this
table with the new full-run evidence. Do not skip failures, assert the buggy
result, or broadly catch exceptions to obtain green output.

## First remediation batch: 2026-10-30

The suite now has **21 checks: 19 pass, 2 fail**, with no skipped cases. Five of
the seven original failures pass. Added checks cover a full 20-person concurrent
scoring burst, valid timer expiry, preserved lead overrides, timer-instance
matching, early-expiry retry instructions, bounded write conflicts, the WAO
settle boundary, restored tap sequences, and concurrent content-pack assignment.

Changes in this batch:

- DIBE state writes compare a small `write_revision` inside existing `state_json`
  and re-run decisions after conflicts. Old snapshots without a revision bootstrap
  on their first successful write; no schema migration is needed. No-ops do not
  write. The retry budget covers the supported 20-person room.
- DIBE description/scoring/show-drawings expiry checks the server deadline.
  Updated clients send the timer start to identify its instance; older clients
  remain accepted but still obey the deadline. An early callback receives a
  server delay and SessionProvider retries it. Deliberate lead overrides remain
  available. The client-only image reveal timer is unchanged.
- WAO rejects input after the timer plus its existing three-second settle window.
  Conflicting sequence reuse now returns 409 instead of acknowledging the wrong
  input. Play state supplies the viewer's last stored sequence so refreshed
  clients resume after it; identical in-window retries still deduplicate.
- Say Less delegates pack lookup/binding to the existing shared resolver, which
  preserves a concurrently assigned pack instead of overwriting it with Pack A.

At the end of this historical batch, the two remaining failures were the SwitchCode incomplete phase transition and
Say Less missing score event after partial writes. Both were subsequently fixed
with transactional coordination and real database verification below.

This is not full R1-R8 compliance. In particular, WAO's admission check and round
locking are not yet a single transaction; multi-tab sequence collisions still
receive an explicit conflict rather than automatic recovery; DIBE team-table/
completion side effects remain separate writes. At this historical stage,
lifecycle ownership, stable operation IDs/generations, and browser recovery were
subsequent work; their updated scope is described below.
The revision protection assumes requests execute the updated server code; do
not test mixed old/new server writers as though both participate in its contract.
These changes have not been deployed or tested against production PostgREST.

## Transactional remediation: 2026-10-30

Both remaining regression assertions now execute against native PostgreSQL 17.9,
retaining their names and testing failed writes followed by recovery. The full
suite has **45 passing checks, zero failures/skips**: 19 database-free checks and
26 native database checks. The normal application suite separately has 283 tests.

Migration `033_atomic_workshop_transitions.sql` supplies atomic commits for:

- SwitchCode clue outcomes, filtered board, guess timer, phase, score, and public
  state. Clue admission shares the transition lock; a changed clue snapshot is
  recalculated. Expected round + phase prevents stale callbacks from advancing
  another round. Duplicate resolution cannot increment the team score twice.
- Say Less pile changes, card/score events, turn endings, round closure, version,
  and public state. A stale version/turn returns a conflict. Failed scoring writes
  are no longer swallowed. Timer, pass, skip, hold, and early-end behavior remain
  the existing engine decisions.

Tests fail writes after clue/round/session/turn/event/public-state changes and
compare the complete old database state after rollback. They then retry, test
two real backend connections competing, lost acknowledgements, both clue filters,
miss/abandon, round 1/2 closure, pass, skip, early round end, and the tenth-turn
pause. Schema checks detect a missing RPC and migration 033 can be replayed.

Apply 033 and verify schema **before deploying these coordinators**. See
[`../../docs/transactional-reliability-release.md`](../../docs/transactional-reliability-release.md).
Nothing in these tests connects to or migrates production. Browser reconnect,
broader lifecycle ownership, and full workshop rehearsals remained outstanding
at this stage; browser recovery coverage is now described below.

## Browser recovery remediation: 2026-10-30

This historical browser-remediation batch had **53 passing checks**: 19 database-free cases and
34 native PostgreSQL cases, with no failures/skips. The original 283 application
tests pass separately. New cases verify atomic card receipts, conflicting reuse
of an operation ID, concurrent copies of one input, identical clue retries, and
read-only detection of missing migration-034 objects.

At that stage, `npm run test:browser` had **25 passing Chrome scenarios**.
It uses actual client screens/hooks, actual API handlers, and a native PostgreSQL
cluster while every socket notification is absent. It covers refresh, pending
input, offline/reconnect, lost/late responses, manual holds, and maintenance with
the facilitator absent. See [the browser report](../browser/README.md) for the
exact boundary and remaining checks. This suite does not certify the hosted
Supabase Realtime transport or other protocols.

This batch required 033/034. The current application also requires 035/036;
verify schema before deployment. Readiness RPCs are read-only. Nothing has been
deployed.

## Coverage still required

The latest local batch has **88 passing reliability checks** (19 database-free,
69 native PostgreSQL), plus 38 separate browser checks. See
[local-reliability-results.md](../../docs/local-reliability-results.md).
`lifecycle.test.mjs` exercises real lobby actions, race interleavings, setup and
completion rollback, delayed input, and session isolation.
`snapshot-generation.test.mjs` covers database-owned revisions and the reset ABA
case. `workshop-simulation.test.mjs` completes both protocols at three headcounts.
The optional console `session_events` table is outside the fixture; its logged
missing-table warnings are expected and do not certify console telemetry.

| Scope | Status / next scenario |
| --- | --- |
| Other protocols and phases | Extended to the remaining ten implemented protocols; see the current extension report for precise scenarios and limits |
| Lifecycle R5 | Covered for changed SwitchCode/Say Less paths and focused DIBE snapshot generation; other protocol adapters/side effects remain unverified |
| Database atomicity R3 | Covered for the changed SwitchCode/Say Less operations on native PostgreSQL; full Supabase stack and other operations remain unverified |
| Browser recovery R6/R7 | Covered for SwitchCode/Say Less on Chrome with PostgreSQL and absent notifications; hosted Realtime, actual device suspension, other protocols remain unverified |
| Timer instance isolation R4 | Not yet implemented: old round's delayed expiry, duplicate expiry, exact boundary and settle tests for each protocol |
| Complete workshops R8 | Native coordinator/database flows pass at SwitchCode 4/8/20 and Say Less 4/8/14; other protocols, people/devices, and hosted load remain unverified |
| Scope isolation | Concurrent SwitchCode/Say Less writes and an untouched control session are checked; broader hosted/multi-team rehearsal remains |

## Adding a scenario

1. Name the contract ID and the visible workshop failure being prevented.
2. Read the protocol spec; put the smallest independently understood fixture in
   the test. Do not compute expected scores by calling the production scorer.
3. Import the actual handler/coordinator through `importApp`; do not copy its
   decision logic into a test implementation.
4. Use `hold(..., { stage: 'afterRead', count: 2 })` to force concurrent snapshots,
   or `failNext(table, operation, count)` for a storage failure. Release barriers
   in `finally` and bound the test with a timeout.
5. Assert durable rows and exact accepted input/score as well as the response.
   Include recovery/retry behavior. A 200 response alone proves very little.
6. For browser/SQL guarantees, use the appropriate real integration layer and
   record it separately. An adapter simulation is not a browser or database test.

Keep this suite separate from the current build gate while establishing the
known-failure baseline. Once repaired and expanded, run it as a required CI check
on a Node 24 test job. No CI workflow has been changed in this task.

## Current extension

`remaining-protocols.test.mjs` covers seven tabular lifecycle adapters.
`remaining-workshops.test.mjs` runs their complete scenarios at three headcounts,
with real write-boundary rollback and independent expected totals.
`remaining-json-pairs.test.mjs` adds Cover Story, DIBE, and WAO complete flows.
`remaining-boundaries.test.mjs` covers twenty concurrent submissions, old game
contexts, lock-waiting deadline admission, explicit input conflicts, and migration
replay/readiness. A deterministic Say Less receipt/read race also lives in
`transactions.test.mjs`. The native fixture now applies every checked-in migration,
with a minimal local auth/role/publication bootstrap; this is not hosted Supabase.
See the extension report above for findings, counts, and test boundaries.
