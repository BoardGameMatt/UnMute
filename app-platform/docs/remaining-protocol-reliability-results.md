# Remaining protocol reliability — local verification

2026-10-30. This extends [the preceding SwitchCode/Say Less report](local-reliability-results.md).
Scope: the ten remaining implemented workshop protocols. All tests use disposable
local PostgreSQL and local Chrome. No hosted project or live workshop was accessed.
No production migrations, data changes, or deployments were made.

## Findings and repairs, in priority order

| Priority | Failure or weakness | Repair and evidence |
| --- | --- | --- |
| P1 — crash | Wrong Answers Only retained every equally optimal pairing. A valid 20-person simulation exhausted the Node heap. | Memoized subset matching counts optimal completions and samples them without retaining all pairings. Existing fairness tests plus 20/24-player regression tests and a complete 24-player database workshop pass. |
| P1 — inaccurate scores | Draw It By Ear cleared each scoring tier's answers before calculating the final individual score. An all-Yes fixture returned only the 3-point tier: 9 rather than 18 per drawer. | Archive accepted answers by tier; independently sum all three tiers. Native tutorial plus three scored rounds verifies individual/team totals at 5, 10, and 20 participants. |
| P1 — partial sessions | All seven remaining tabular protocol starters failed the injected activation boundary: initialization could survive without a fully active workshop. | Start/reset, gameplay decisions, scores, and published state now share one atomic commit. Failed-start and failed-reset snapshots must remain identical; simultaneous Starts have one winner. |
| P1 — incomplete commits | Inspection found separate writes in phase progression, Cover Story dealing/finalization, WAO closure/scoring, and DIBE team mirroring/completion. | Real-database failure injection verifies rollback at the writes exercised by the workshop simulations. DIBE snapshot triggers commit related team records/completion together; WAO commits all pair results with closure. These are regression evidence, not claims that each boundary was separately observed failing in production. |
| P1 — lost input and stalled recovery | WAO's tap queue existed only in memory and discarded failed retries. DIBE marked forms submitted before the write succeeded; a rejected submission could prevent its expiry callback. Other hooks/drafts had inconsistent recovery. | Persist exact input IDs/payloads, reconcile authoritative state after resume and without sockets, bound requests, and release guards on failure. Actual DIBE form tests cover refresh, lost ACK, and scoring timer recovery. WAO includes two tabs with the same prior sequence. |
| P2 — duplicate acknowledgement race | The final full run intermittently rejected one of two identical Say Less card retries. Its receipt lookup could precede the competing commit, while its session read followed it. | Recheck the exact receipt before rejecting a newer turn version. A deterministic native database interleaving now verifies both calls acknowledge one receipt and one score. |
| P2 — wrong-window acknowledgement | Inputs could be decided before a database lock and written after the deadline; delayed callbacks could address a later game/round. Airtime acknowledged a changed locked choice without applying it. | SQL rechecks declared deadlines after acquiring locks. Generation/phase/round/timer context rejects obsolete intent. Airtime explicitly conflicts on a changed locked choice. Native lock-wait tests cover Truth Is, DIBE, and WAO; seven protocols reject a previous generation's timer. |

The architecture and game mechanics remain: Next.js, TypeScript engines,
Supabase/PostgreSQL, and Realtime. This work repairs execution and recovery
patterns. It does not introduce a new platform or new game rules.

## Shared implementation pattern

- `lib/session/workshop-transaction.ts` stages the existing tabular coordinators'
  reads/writes against one coherent database snapshot. Actual PostgreSQL supplies
  defaults, IDs, constraints, rollback, and the final commit. Catalog reads remain
  read-only. Unsupported operations fail explicitly.
- Migration 037 declares each protocol's mutable tables, scopes its rows, locks
  team/parent, compares the read set, and commits related writes together. CAS
  conflicts retry the complete decision within a bounded 32 attempts; no stale
  patch is blindly reused. Twenty simultaneous Truth Is submissions are tested.
- Each new tabular input carries a stable operation UUID and an opaque workshop
  context. The receipt commits with the result. An exact retry is acknowledged;
  ID reuse for different input/actor conflicts. Editable shared layouts also
  carry the authoritative revision. Deadlines come from each existing engine.
- DIBE retains its JSON engine. Migration 038 synchronizes team rows and explicit
  completion in the snapshot transaction, checks scoring admission using the DB
  clock, and provides root-first CAS plus exact receipts for new clients. The
  compatible no-UUID path still executes the atomic triggers.
- WAO uses operation IDs for durable taps and allocates their sequence on the
  server, preserving independent tabs. Broadcast failure cannot reverse a
  committed acknowledgement. Notification delivery only prompts reconciliation.
- `hooks/useWorkshopPlay.ts` shares the existing recovery hook across the seven
  tabular protocols and Cover Story. WAO reconciles its pair/reveal APIs; DIBE
  persists scoring drafts/submissions and resumes elapsed shared timers. Drafts
  are scoped to participant, generation, round/phase, and timer where applicable.

Keep engine rules in protocol modules. When a coordinator needs a new query,
table, default, or RPC, explicitly extend the transaction boundary and test its
rollback. Do not bypass it with an undeclared write or add a silent legacy
fallback when the required migration is missing.

## Complete database workshop scenarios

Each row uses real application coordinators and the checked-in SQL. Expected
scores are calculated independently in the test, rather than by calling the
production scoring function for the expected value.

| Protocol | Tested participant counts | Scenario |
| --- | --- | --- |
| Talk Track | 4 / 10 / 20 | Two cycles; independently expected 15-point turns and final team totals |
| Zoning Rights | 3 / 8 / 20 | All individual and team rounds; exact assignments and authoritative guesses |
| I Know What You Meme | 3 / 8 / 20 | Both collections and every reveal; independently counted guesses/scores |
| Rank and File | 3 / 8 / 20 | Five exact rounds and five points |
| The Truth Is | 3 / 8 / 20 | Both collections, ordinary/bluff scoring, wrap and debrief |
| Airtime | 2 / 8 / 16 | Five dives; independently valued retained inventory and score/event rows |
| On the Same Page | 8 / 12 / 16 | Three scored rounds; independent role scores and rotation debt |
| Cover Story | 3 / 8 / 15 | Both sittings, disjoint hands, reveal/finalization and independently marked scores |
| Draw It By Ear | 5 / 10 / 20 | Tutorial, team formation, three scored rounds, explicit End after Final Results |
| Wrong Answers Only | 2 / 8 / 24 | Four rounds, pair selection/closure, independent points and reset |

Fixtures seed the real authored Talk Track cards and Cover Story library where
those catalogs are outside migrations. DIBE image criteria and WAO question
choices are deterministic test fixtures. These checks do not validate external
image/Giphy services or the editorial quality of all production content.

## Verification

Final full runs passed:

- **146 reliability checks:** 19 database-free and 127 native PostgreSQL cases.
- **84 Chrome recovery cases:** previous 38 plus 35 shared-hook/form cases,
  seven WAO cases, and four DIBE scoring/timer cases.
- **285 application tests**, standalone TypeScript, and production build.

The build retains three pre-existing Zoning Rights React dependency warnings and
an old Browserslist data notice. Optional `session_events` telemetry is absent in
the checked-in local bootstrap. Local WAO broadcast attempts deliberately have
no transport; their logged failures do not invalidate committed database results.
Test summaries are in ignored `output/playwright/{reliability-results,browser-results,
application-tests,build-results}.txt`; the checked-in tests reproduce the evidence.

Commands (from `app-platform`, Node 24, locally installed Chrome):

```powershell
npm test
npm run test:reliability
npm run test:browser
npx tsc --noEmit --incremental false
npm run build
```

Tests bind loopback ports and create/remove fresh temporary database clusters.
They do not accept an existing workshop database. The production build uses
placeholder Supabase credentials for compilation only.

## Deployment handoff and limits

Apply **037_remaining_workshop_transactions.sql**, then
**038_json_and_pair_workshop_guards.sql**, after the earlier 033–036 migrations
and before deploying this app. Run `npm run verify:schema` in the intended
environment; the new read-only `workshop_remaining_reliability_schema_ready`
probe requires the transaction functions, receipt support, valid tap index,
and enabled guards. Native tests replay both new migrations and verify that
readiness fails when an admission trigger is disabled. Nothing has been applied
to a hosted database by this work.

Browser coverage uses actual hooks and API handlers for all ten protocols.
Actual screen tests exercise SwitchCode/Say Less plus the DIBE scoring form and
Truth Is/Rank and File/IKWYM entry forms. Most remaining browser cases mount the
real hook in a small probe, not every full protocol screen. All socket upgrades
are deliberately rejected: passing demonstrates reconciliation without events,
not certification of Supabase Realtime rejoin/delivery.

Still required with an isolated hosted environment: Supabase/PostgREST and
Realtime reconnect behavior, authentication/RLS transport, Next.js SSR/navigation,
real-device/background behavior, realistic network delays, and throughput across
multiple workshops. The shared unit of work compares a complete scoped snapshot;
hosted latency, payload growth, and production polling cost have not been
benchmarked. These tests do not prove every legal game branch or every interleaving.
See [the hosted handoff](hosted-realtime-todo.md).

DIBE's already discarded historical tier answers cannot be reconstructed by this
fix. New accepted tiers retain their inputs; no existing production scores were
rewritten. Existing timing choices, including the previously recorded SwitchCode
spec discrepancy and Rank and File's implemented timing, were preserved.
