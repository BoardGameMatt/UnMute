# TODO: hosted Realtime and workshop recovery

Developer handoff — 2026-10-30.

The goal is accurate input, correct scores, and continuous workshop flow after
refreshes, missed notifications, and interrupted connections. Keep the current
stack and game mechanics. Follow [Voice](voice.md), the
[reliability contract](workshop-reliability.md), and each protocol's specification.

**Status:** hosted Supabase tests have not run. This checkout has no configured
Supabase credentials or authenticated Supabase CLI. The owner does not currently
have a Supabase test environment. No hosted project, hosted runner, or production
change has been created.

**Local work update:** recovery, atomic persistence, lifecycle, and complete
workshop simulations now extend across the remaining ten implemented protocols.
See [the current extension report](remaining-protocol-reliability-results.md) for
findings, exact tests, and limits: 146 reliability checks, 84 Chrome cases, and
285 application tests pass locally. Migrations 037/038 join the earlier pending
migrations; no hosted migration or test has run. The older counts below record
the historical baseline.

## Already completed

This historical baseline records the preceding implementation work. The local
work update above supersedes these test counts.

- [x] SwitchCode related phase/score/clue writes commit atomically.
- [x] Say Less pile, score event, turn ending, and public state commit atomically.
- [x] Browser drafts and pending gameplay inputs survive refresh/reconnect in
  SwitchCode and Say Less; identical retries cannot add points twice.
- [x] Local browser recovery: **25 passing Chrome scenarios**.
- [x] Reliability suite: **53 passing checks**, including **34 native PostgreSQL
  cases**. Existing application suite: **283 passing tests**.
- [x] TypeScript and production build passed. Production has not been updated.

See [browser coverage](../tests/browser/README.md),
[database coverage](../tests/reliability/README.md), and
[release instructions](transactional-reliability-release.md).
The local browser suite deliberately has no Realtime delivery. Its success is
evidence of recovery without notifications, not a hosted Realtime certification.

## Work we can complete without Supabase access

### 1. Reproduce and repair shared session recovery gaps — local work completed

- [x] Add browser regressions for
  [SessionProvider](../components/providers/SessionProvider.tsx) itself, observing
  `useGameState()` rather than only the protocol-specific play-state hooks.
- [x] Cover initial read failure, recovery after missed updates, an older snapshot
  arriving late, and session changes while a request is pending. Actual hosted
  socket startup/rejoin delivery remains in section 4.
- [x] Implement authoritative snapshot reconciliation on subscription success,
  reconnection, focus/resume, and a bounded fallback. Keep the last valid state
  on transient errors and show connection/retry status.
- [x] Cancel or ignore obsolete responses; protect session identity and ordering.
  Choose an explicit persisted revision/generation approach where needed. A
  client request counter alone does not establish server-state ordering.
- [x] Release request guards after errors/timeouts, clean up listeners/channels,
  and stop unnecessary polling when the session has actually ended.

**Original finding (now repaired):** code inspection showed one initial read, direct application of incoming
event payloads, and no subscription-status reconciliation in SessionProvider.
An initial read error also installed a synthetic `waiting` state. These were
inspection findings, not failures measured against hosted Supabase.
SwitchCode/Say Less currently have their own recovery fallback through
[useRecoverablePlay](../hooks/useRecoverablePlay.ts); other consumers of the
shared provider now receive basic snapshot recovery as well. Protocol-specific input, persistence, and lifecycle coverage now extends to the
remaining implemented protocols; see the extension report for the tested paths.

**Done when:** the new regressions pass, authoritative state cannot rewind, and
an interrupted shared-state consumer catches up without another event or a new
participant identity. Preserve current protocol behavior.

### 2. Build the isolated hosted test runner

- [ ] Extend the test infrastructure under `tests/` with a separate hosted mode.
  Keep `npm run test:browser` and `npm run test:reliability` local by default.
- [ ] Use a dedicated `.env.hosted-test.local` and a checked-in example containing
  placeholders only. Require the test project reference, URL, browser
  anon/publishable key, and server-only service-role key. Never fall back to
  production `.env.local` or expose the service-role key in browser bundles/logs.
- [ ] Require an explicit non-production project selection. Validate URL/project
  reference agreement and refuse a known production target before any write.
- [ ] Use real Supabase PostgREST/RPCs and the actual browser client/WebSocket
  transport. Do not translate hosted calls through the local PostgreSQL adapter
  and then report hosted coverage.
- [ ] Create fixtures with fresh UUIDs and a run identifier. Track exact owned
  team/session/participant IDs before dependent writes. Use read-only existing
  content packs; do not change shared library data.
- [ ] Add cleanup in `finally`, using only those recorded IDs and their dependent
  rows. Never truncate tables or delete by a broad name/time filter. Report exact
  leftover IDs if cleanup fails and provide a scoped cleanup procedure.
- [ ] Add bounded waits and useful evidence: channel status changes, received
  event identifiers, authoritative snapshots, recovery times, and durable totals.
  Keep secrets and real participant information out of reports.
- [ ] Add a separate npm command and CI job for hosted checks once implemented.
  Missing configuration must report **not run / failed setup**, not a green pass.

**Starting points:** [browser server](../tests/browser/server.mjs),
[browser scenarios](../tests/browser/recovery.test.mjs), and
[fixture shapes](../tests/reliability/transaction-fixtures.mjs).
The existing Node loader intentionally blocks external fetch; any hosted mode
must explicitly support only its selected test origin without weakening the
local runner's network isolation.

**Done when:** runner/configuration/isolation tests pass locally and the hosted
command refuses an unconfigured or production target. Mark actual service
verification pending until the next section is complete.

## Work that needs a Supabase test environment

### 3. Provision and verify a dedicated project or branch — prerequisite

- [ ] The application owner/developer identifies or creates a non-production
  Supabase project/branch. Record its reference, owner, and isolation purpose.
  Do not clone live workshop participant data into fixtures.
- [ ] Verify its schema/migration history and content dependencies. Apply the
  intended migrations to that test environment, including **033 and 034**,
  before testing the current application.
- [ ] Do not assume the local subset bootstraps the entire product: the native
  harness uses migrations 001, 019, 025, 032, 033, and 034, with a minimal
  auth/role/publication bootstrap.
- [ ] Run the read-only schema checks. Both
  `workshop_transaction_schema_ready()` and
  `workshop_browser_recovery_schema_ready()` must return true.
- [ ] Confirm `public.session_state` is in the Realtime publication and that the
  browser's actual role can read and receive its intended rows under the test
  environment's grants/RLS. Service-role success alone is insufficient evidence.
- [ ] Use a staging build or local Next server pointed exclusively at this test
  project. Record which HTTP, cookie, join, and navigation paths are real versus
  adapted. Do not test by opening a live workshop host link.

**Done when:** an anon/publishable browser client receives a real database-change
event for a newly created test session, and schema/configuration checks pass.
See [Supabase's Postgres Changes setup](https://supabase.com/docs/guides/realtime/postgres-changes)
for publication and role prerequisites.

### 4. Run actual Realtime recovery scenarios — high priority

For each scenario, assert both what the participant sees and what is durably
stored. Use separate facilitator and participant browser contexts. Prove initial
event delivery and a later successful delivery after reconnection; polling alone
must not make a broken socket test appear to pass.

| TODO | Scenario | Required evidence |
| --- | --- | --- |
| [ ] | Normal subscription and live change | Channel reaches `SUBSCRIBED`; a real update for the test session is received and the UI matches the database. |
| [ ] | Abrupt socket loss while HTTP stays available | Force a real socket closure; HTTP fallback keeps progress moving; the SDK reconnects and subsequent events arrive. |
| [ ] | Missed event with no later change | Disconnect, commit input/advance from another client, reconnect, then send no extra event. The returning UI catches up from authoritative state. |
| [ ] | Repeated reconnect cycles | Repeat loss/recovery; no duplicate listeners, accumulating channels, duplicate scores, or permanent busy state. |
| [ ] | Full offline/online | Queue an input, restore connectivity, and confirm one accepted effect or an explicit expired-input rejection. |
| [ ] | Refresh before acknowledgement | Interrupt a submitted clue/guess/card response, refresh, and confirm exact input and one durable result. |
| [ ] | Socket failure in manual/paused phases | Change phase from another client; the waiting client catches up without relying on a running timer. |
| [ ] | Initial subscribe/read race and delayed responses | Commit during startup and hold/release an older response; no accepted input disappears and the UI does not rewind. |
| [ ] | Facilitator disconnect | Remaining participants reconcile valid deadlines and continue according to the spec without a facilitator timeout callback. |
| [ ] | Two simultaneous workshops | Updates/retries in one test session do not affect the other session's UI, inputs, or scores. |
| [ ] | Publication/permission failure | In a disposable test environment, deliberately break delivery; the test detects a failed channel/event path even if HTTP fallback works. Restore configuration afterward. |

Measure socket reconnection time separately from application convergence. The
contract targets UI convergence within **five seconds after HTTP/server
availability returns**; do not silently extend this target to hide a failure or
present it as a guaranteed hosted WebSocket reconnect time. Never manufacture
payloads and call them real missed-event evidence.

**Done when:** all scenarios have recorded pass/fail results and timing, every
reproduced defect has a regression and a fix, and fixture cleanup is verified.

## Follow-on workshop readiness work

- [ ] Extend the recovery pattern/tests to other protocols, starting with shared
  SessionProvider consumers. Passing SwitchCode/Say Less does not cover them.
- [x] Test facilitator start/reset/cancel races, stale controls/input, and failed
  completion for SwitchCode/Say Less (R5). Other protocol adapters remain below.
- [ ] Extend lifecycle race coverage and fixes to remaining protocol adapters.
- [ ] Exercise delayed expiry from a prior round/turn and exact deadline
  boundaries for each protocol; preserve its specified grace/settle rules.
- [x] Run complete local coordinator/database simulations at minimum, typical,
  and maximum headcounts for SwitchCode and Say Less, with independent totals.
- [ ] Cover other protocols and rehearse complete workshops with people/devices.
- [ ] Measure request/query load with current reconciliation polling. Check hosted
  latency, limits, and cold starts at realistic workshop sizes before tuning.
- [ ] Test physical iOS/Android phones: background/foreground, screen lock, Wi-Fi
  changes, and browser process eviction. Desktop viewport tests do not cover this.
- [ ] Verify full join/rejoin and Next navigation on staging, plus shared-screen
  pin behavior after refresh. Preserve the existing participant identity.

## Validation and handoff requirements

For changed persistence/client synchronization paths, run from `app-platform`
with Node 24 and Chrome installed:

```powershell
npm ci
npm test
npm run test:reliability
npm run test:browser
npx tsc --noEmit --incremental false
npm run build
```

The build needs Supabase environment variables. For a local compile check without
service access, set these in that PowerShell process before `npm run build`:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "build-placeholder"
$env:SUPABASE_SERVICE_ROLE_KEY = "build-placeholder"
```

Hosted tests require real test credentials. Never use build placeholders as
evidence of service access, and never deploy with them.

Record the code revision, test project reference, migrations, browser/device,
scenario results, socket events, convergence times, score/input assertions,
remaining gaps, and cleanup outcome. Keep a reproduced failure enabled until
fixed. A proposed runner or skipped hosted test is not a verified hosted result.

Deployment is a separate step: apply required migrations before shipping the new
app, verify schema, commit all new imports/files, and follow
[the production procedure](../../docs/production-deploy.md) for **unmute-app**.
Do not treat the separate `un-mute` Vercel project as the product deployment.
