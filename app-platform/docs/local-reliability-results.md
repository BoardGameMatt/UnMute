# Local recovery, lifecycle, and workshop verification

Current extension: [all remaining implemented protocols](remaining-protocol-reliability-results.md).
The earlier counts and limited protocol scope below describe the previous batch.

2026-10-30. Scope: shared session recovery, facilitator races, and complete
SwitchCode/Say Less flows on disposable native PostgreSQL. Game rules, scoring,
and existing timing are preserved. No production changes have been applied.

## Changes and evidence

| Area | Reproduced failure | Change |
| --- | --- | --- |
| Shared session reads | Failed initial reads installed a false waiting state; missed updates/resume did not recover without another event | Bounded reads, authoritative reconciliation on connection/resume and a two-second fallback; retain the last valid state and display connection status |
| State ordering | A JSON revision can restart at the same value after reset; old snapshots/actions can belong to another game | Database-owned snapshot revision and session lifecycle generation; reject old responses and stale action envelopes |
| Start ownership | Both protocol starters could replace an active game; a delayed lobby Start could change an earlier winner | Start locks the parent session and atomically prepares protocol rows, public state, and active status |
| Reset | Separate deletes/state/status writes could leave a partial reset or accept delayed input into a new game | Expected generation plus a transaction; gameplay and reset acquire parent/protocol locks in a consistent order |
| Setup/progression | Team orders, previews, turn creation, next round, and completion had separate write boundaries | Transactional setup, turn/round creation, and completion, with explicit conflicts and retryable failures |
| Facilitator browser | A rejected Start request left the button busy; a hung request had no bounded UI failure path | Catch failures, release busy guards, and stop waiting after eight seconds; a late server commit remains protected by lifecycle checks |
| Lifecycle navigation | A client could miss Start or stay on the play screen after a reset | Lobby clients reconcile status; play-screen navigation consumes the shared provider's reconciled status |

The first three shared-provider cases and the initial three destructive-start
cases were run as failing regressions before remediation. Missed Start and hung
Start browser cases also failed before their fixes. Subsequent boundary cases
extend that evidence; they are not all claims of separately observed production
incidents.

## Verification

- **38 Chrome cases:** original 25 protocol cases plus 13 shared-provider,
  lifecycle-navigation, and lobby cases. Includes offline/online, failed reads,
  stale snapshots, session switching, terminal polling cleanup, missed Start,
  and a hung server-action request. The latter uses a controlled browser clock.
- **88 reliability checks:** 19 database-free cases and 69 native PostgreSQL cases.
  Includes 24 lifecycle/isolation cases, five revision/generation/schema cases,
  and six complete workshop simulations alongside the original regressions.
- **283 existing application tests**, standalone TypeScript checking, and the
  production build. Build uses placeholder credentials only for compilation.

Full workshop simulations use actual lobby actions/coordinators and checked-in
SQL functions. SwitchCode runs at **4, 8, and 20 players**, completes one entire
guesser rotation, verifies clue filtering, mixes hits and misses, checks shown
statistics, wraps, and completes. Say Less runs at **4, 8, and 14 players**, uses
the real **20-card deck**, confirms teams/previews, plays both rounds, exercises
timeouts/skips/holds/pauses, and checks team totals from accepted intended inputs.
These are functional database simulations, not hosted throughput benchmarks or
human workshop rehearsals.

Fault tests fail real writes after earlier writes in the same transaction, then
compare durable rows and retry. Separate database connections race starts and
turn creation. Delayed clue/scoring operations cannot affect a restarted game;
concurrent sessions preserve their own scores and public state. A Draw It By
Ear handler test resets/reinitializes with the same JSON revision and proves an
old action is still rejected by the database revision/generation guards.

Run from `app-platform` with Node 24 and Chrome installed:

```powershell
npm ci
npm test
npm run test:reliability
npm run test:browser
npx tsc --noEmit --incremental false
npm run build
```

For focused investigation use `npm run test:workshops`,
`npm run test:reliability:lifecycle`, or `npm run test:browser:shared`.
The full suites are required for a complete result summary.

## Required migrations before deployment

Apply the existing prerequisites through 034, then:

1. [035_session_snapshot_revision.sql](../supabase/migrations/035_session_snapshot_revision.sql)
   adds the database-owned snapshot revision and its trigger. Writers cannot
   reset this revision by clearing JSON or supplying their own value.
2. [036_workshop_lifecycle.sql](../supabase/migrations/036_workshop_lifecycle.sql)
   adds the parent session generation and atomic lifecycle/setup functions.

Run `npm run verify:schema` in the intended environment. It now also requires
`workshop_session_reliability_schema_ready()` to return true. The SQL audit
checks the revision column/trigger, lifecycle column, and new functions. Tests
verify replaying the migrations and detecting a disabled revision trigger.

Deploy outside active workshops: older server writers do not participate in all
new guards. All new files/imports must be committed with the calling code. See
[release instructions](transactional-reliability-release.md) and the
[production procedure](../../docs/production-deploy.md). Nothing was deployed.

## Boundaries at the end of the preceding batch

- The shared provider and lifecycle navigation serve all their consumers.
  Detailed protocol start/reset/setup/full-flow coverage is for SwitchCode and
  Say Less. Common JSON-protocol lifecycle wiring is updated, with a focused
  Draw It By Ear reset/reinitialize test; this does not certify every DIBE/WAO
  side effect or other protocol's lifecycle adapter.
- At that point, other lobby adapters and DIBE side effects retained their
  separate writes. The [extension report](remaining-protocol-reliability-results.md)
  now records their transaction fixes and detailed coverage.
- The local browser server adapts the Next page shell, navigation, and server-
  action HTTP bridge. Router intent is checked; full deployed SSR/join/navigation
  behavior, hosted Supabase/PostgREST/Auth/Realtime, and physical device suspension
  remain unverified. See [browser coverage](../tests/browser/README.md).
- Native PostgreSQL applies migrations 001, 019, 025, 032–036 and a minimal auth/
  role/publication bootstrap. The optional console `session_events` table is
  outside that fixture; its expected missing-table warnings do not fail play.
  Console telemetry and complete migration bootstrap are not certified by this
  suite. No external database or live workshop is accessed.
- Polling load and hosted latency still need measurement. Local recovery targets
  five seconds after availability returns; this is not a production SLA.
- Existing SwitchCode spec/runtime discrepancy: the spec says a 30-second write
  phase, while the pre-existing engine uses 60 seconds. This batch retains the
  runtime timing to preserve functionality; the owner should reconcile the spec
  and intended duration separately.

Continue with the remaining items in the
[hosted and workshop handoff](hosted-realtime-todo.md).
