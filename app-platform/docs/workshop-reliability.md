# Workshop reliability contract

Status: authoritative engineering standard; adoption is incremental.
Scope: all participant and facilitator session flows. Priority: accurate results,
continuous workshop flow, and recovery without losing progress.

This is a target contract, not a statement that existing protocols satisfy it.
The current implementation has known violations exposed by the reliability
harness. Security hardening is a separate workstream.

## Authority and mechanics

Root AGENTS.md sets project rules. Individual specs in `../../docs/protocols/`
(and `../../docs/Protocol_Spec_Draw_It_By_Ear.md`) define game mechanics;
`../../docs/protocols/moment-conventions.md` defines product conventions.
This document defines how those mechanics must execute reliably. For example,
the spec chooses scoring and timeout behavior; this contract requires those
choices to survive concurrent requests and failed connections.

Record ambiguities and choose the conservative interpretation. Do not invent
rounds, scoring, or facilitator powers to work around an implementation problem.
Where an older implementation reference conflicts with this reliability contract,
follow the guarantees here and record the migration needed. Do not copy an older
protocol's persistence or reconnect behavior merely because it already exists.

## Required guarantees

| ID | Guarantee | Evidence required |
| --- | --- | --- |
| R1 | A successful acknowledgement means the exact requested input is durably represented, or explicitly identified as an identical retry. A conflicting request must not be silently acknowledged. | Replay, response-loss, and reload tests against the handler. |
| R2 | Concurrent actions preserve all accepted independent inputs. A stale request or no-op cannot overwrite newer state. | Force both requests to read the same revision; exercise both completion orders. |
| R3 | State, scores, events that determine scores, phase, and the data required by that phase commit together. A failure leaves either the complete old state or complete new state. | Fail every write boundary; retry and verify invariants and totals. |
| R4 | Deadlines are enforced by server time, independently of browser timers. Expiry identifies the exact session generation, round, and timer instance. | Before/at/after deadline tests, duplicate expiry, delayed expiry from a prior round. |
| R5 | Start, reset, and completion have one winner and cannot race with gameplay. A delayed start cannot delete a running session. | Two facilitator tabs; start versus reset/cancel; input versus reset. |
| R6 | An interrupted or stale client eventually converges on authoritative state without resetting the session or requiring a new identity. Older responses cannot replace newer state. | Disconnect, missed event, out-of-order response, refresh, background/resume tests. |
| R7 | Progress does not depend on one browser or one notification. Expiry/reconciliation can be safely repeated, and failure has a bounded recovery path. | Miss every notification; lose the facilitator; interrupt expiry; restore connectivity. |
| R8 | Results are reproducible from committed authoritative inputs. Retries cannot add points twice; missing score events cannot be hidden by a success response. | Independent expected totals from small spec fixtures, repeated completion, failure after commit. |

## Standard action and persistence approach

Use a pure typed engine for game decisions and a server action coordinator for
execution. Validate runtime payloads before invoking the engine; client TypeScript
types are not runtime validation. Keep protocol-specific rules in the protocol
module, but share the action envelope, persistence/retry contract, and recovery
semantics instead of reimplementing them differently per protocol.

Each logical operation should carry:

- `operationId`: unique per intended action, stable across retries and independent
  across tabs/reloads. A resettable local sequence alone is insufficient.
- `generation`: changes on reset/restart, so delayed input cannot affect a new game.
- The relevant round/turn/timer identifier and expected revision where necessary.
- A typed protocol payload. Derive the actor from the session context.

The server loads the authoritative state, validates generation and action context,
then applies the engine inside a safe persistence boundary. Prefer one Postgres
transaction/RPC for related tables. A single-row state update may use compare-and-
swap with a revision, but retry the whole decision against current state; never
retry the stale write itself. Checking the phase in an earlier query is not enough.

Inside the same transaction, persist the operation ID, a payload fingerprint,
the state/score changes, and the resulting revision. The identical retry returns
the original acknowledgement. The same ID with different content is an explicit
conflict. A no-op does not write an old snapshot. Use bounded retries for genuine
write conflicts and surface an actionable error when they are exhausted.

The response should identify the accepted operation and resulting revision.
If the response is lost after commit, retry the same operation ID. Never create
a fresh operation merely because the request timed out. Preserve pending inputs
until acknowledgement or an explicit rejection, including across reload where
the action can still be valid.

The Truth Is's `save_truth_is_snapshot` is an existing example of atomic saves
with version checks. It is a useful persistence example, not proof of complete
R1-R8 compliance; operation deduplication and client recovery still need review.

## Timers, lifecycle, and recovery

Persist server deadlines. Browser arcs display them; browsers may request expiry
but cannot declare it early. Specify the exact boundary and any settle/grace
window in each protocol adapter. Validate input and expiry against that same
boundary atomically. Repeated expiry does not advance a later timer with the
same phase name.

Acquire start/reset ownership before clearing or creating protocol rows. Make
the transition transactional where possible. If initialization requires a durable
intermediate state, model it explicitly with a safe retry path. A failed start
must leave an operable lobby; a failed reset must preserve a recoverable game.

Realtime messages are notifications that new state is available. They are not
the only source of truth. Subscribe and reconcile an authoritative snapshot on
initial connection, reconnection, and resume. Accept only monotonically newer
revisions within the current generation. Coalesce requests or ignore obsolete
responses so slower reads cannot rewind the UI.

While a session is active, use a bounded reconciliation fallback even in manual
hold/ready phases. Timer maintenance may run on server requests if every active
client reconciles and maintenance safely catches up after all clients return;
otherwise provide a server scheduler. Never depend solely on a particular
facilitator's timeout callback. Stop retry loops when a session completes.

Network failures must release busy guards, retain pending inputs, and offer a
visible reconnect/retry state. Facilitator recovery controls operate through
validated server actions and preserve accepted work according to the spec.
Record session/generation, operation ID, revision, and transition in diagnostic
logs so a failed workshop can be reconstructed without guessing.

## Validation layers and release evidence

1. Engine tests: spec examples, legal transitions, conservation/scoring invariants,
   and deadline boundaries. Expected values come from the spec, not the reducer.
2. Local failure harness: actual handlers/coordinators, deterministic interleavings,
   duplicate requests, lost responses, and failed writes. This is available now;
   see `../tests/reliability/README.md` for coverage and current failures.
3. Real database integration: disposable local Supabase, migrated from scratch;
   concurrent connections, actual unique constraints and RPCs, rollback, and
   migration verification. This layer is required before claiming database
   atomicity. Native PostgreSQL tests now cover the changed SwitchCode/Say Less
   transactions using the actual dependency migrations, real concurrent backend
   connections, and injected write failures. The full Supabase stack and the
   remaining protocol operations still need separate integration coverage. See
   `../tests/reliability/README.md` for the exact scope.
4. Browser recovery: separate browser contexts for facilitator and participants,
   viewport/device variations, dropped HTTP responses, offline/online, missing
   socket events, reversed response order, refresh and background/resume. This
   layer is required before claiming R6/R7. SwitchCode/Say Less now have real
   Chrome checks backed by native PostgreSQL, including refresh, offline/online,
   lost acknowledgements, absent notifications, and interrupted expiry. See
   `../tests/browser/README.md` for the exact scope. Hosted Realtime transport,
   actual device suspension, and other protocols remain separate checks.
   Shared-provider and lobby recovery are also covered locally; see
   `local-reliability-results.md` for the current 38-case browser scope.
5. Workshop rehearsal: supported minimum, typical, and maximum headcounts; at
   least two concurrent teams/sessions; complete start-to-results flows. Restore
   connectivity and ensure every screen converges without facilitator repairs.
   Complete coordinator/database simulations now cover SwitchCode at 4/8/20 and
   Say Less at 4/8/14 players. Human/device rehearsals and hosted load remain
   separate from those functional simulations.

For browser recovery, the initial acceptance target is convergence within five
seconds after connectivity and server availability return, including manual
hold phases. This is an engineering target to measure, not a verified SLA. Test
timer boundaries using a controlled clock rather than waiting through games.

For each protocol, record supported player counts, action/phase map, invariants,
spec-derived expected scores, all scenario results, environment/commit, and
uncovered paths. A coverage table must distinguish implemented, failing, and
not-yet-tested scenarios. A green engine suite alone is not workshop readiness.

New or changed flows must pass relevant checks. Existing reliability failures
remain visible until fixed; they must not be skipped or inverted into passing
tests. Do not claim a known-failing flow is workshop-ready. Production release
also follows `../../docs/production-deploy.md`: product build, pending migrations,
schema verification, and the correct Vercel project.

## Remaining protocol implementation evidence — 2026-10-30

See [the local extension report](remaining-protocol-reliability-results.md) for
the transactional boundary, action receipts, scoped context, deadline admission,
complete workshop fixtures, and browser recovery now exercised across the ten
remaining implemented protocols. Migrations 037/038 are required. This evidence
extends the previous SwitchCode/Say Less work; it does not certify hosted
Realtime or every protocol branch. Keep future fixes mapped to R1–R8 and retain
real-database rollback assertions at every newly introduced write boundary.
