# Browser recovery checks

Current extension: [all remaining implemented protocols](../../docs/remaining-protocol-reliability-results.md).
The earlier counts and limited protocol scope below describe the previous batch.

The [workshop reliability contract](../../docs/workshop-reliability.md) defines
the assertions, principally R1, R3, R6, R7, and R8. These tests exercise actual
SwitchCode and Say Less screens in Chrome, using actual application API handlers,
authorization helpers, coordinators, and native PostgreSQL 17.9 transactions.

## Run

Use Node 24, install the locked dependencies with `npm ci`, and have Chrome
installed. Then run from `app-platform`:

```powershell
npm run test:browser
```

To use Playwright's bundled Chromium instead, install it with
`npx playwright install chromium`, set `UNMUTE_BROWSER_CHANNEL=chromium`, and run
the same command. The default run was verified with locally installed Chrome
on Windows; Chromium/Firefox/WebKit and real mobile devices are separate checks.
Browser screenshots go in `output/playwright/` (ignored by Git).

The tests start a new loopback HTTP server and a fresh PostgreSQL cluster, then
close browsers, stop servers, and remove the temporary database. They do not
read `.env.local`, accept an external database URL, mint production codes, or
contact a deployed workshop. Allow local browser and native process execution.
The native PostgreSQL install script must be enabled; on Linux run as a normal
non-root user. No system users or database services are created.

## What is real, and what is adapted

`server.mjs` uses esbuild to bundle the checked-in React components, hooks,
SessionProvider, and Supabase browser client. It serves that bundle with the
project's compiled Tailwind CSS. The page shell supplies real fixture identity
and an HTTP-only participant cookie. Tests use separate browser contexts for
different participants and separate tabs for the same participant.

The real API route handlers run under the existing Node reliability loader.
Next response/cookie/navigation infrastructure, the server-action HTTP bridge,
and Supabase server-client factories are adapted. Actual lobby server actions
execute; navigation assertions inspect router intent rather than deployed Next
SSR routing. AsyncLocalStorage scopes cookie/database context per request.
The SQL adapter translates the query-builder calls to parameterized SQL against
the service-role pool. Game logic, SQL functions, transactions, locks, constraints,
and durable inputs/scores execute unchanged. The dependency migrations are 001,
019, 025, and 032–036. Four-person fixtures use a small deck so score and
pile expectations can be checked directly.

Realtime is deliberately unavailable for every scenario: the local endpoint
closes socket upgrades without delivering notifications. Tests also interrupt
HTTP requests, hold actual responses, and use Chrome's offline mode. Captured
stale responses come from the real handler; the test does not invent play-state
responses. Database deadlines are moved in controlled fixtures to test recovery
without changing game timers or waiting through whole rounds.

This proves application recovery without Realtime delivery. It does **not** test
Supabase's WebSocket reconnect implementation, hosted PostgREST, Auth/SSO, RLS,
Next SSR/navigation/join flows, or a deployed Vercel instance. The page shell and
Next navigation adapter are test-only. None are application routes or production
build aliases. Focus/resume signals are exercised in Chrome; actual OS suspension,
mobile browser eviction, and browser restart still need device rehearsal.

## Covered scenarios

The original protocol suite contains **25 scenarios**. The full command now has
**38 passing scenarios**, with no skips, including 13 shared-provider, lifecycle
navigation, and lobby cases. The first three protocol cases and the initial
shared-provider cases were reproduced as failures before remediation.

- SwitchCode clue and guess drafts survive refresh without being submitted.
- Accepted clues and participant identity survive refresh.
- Offline inputs are retained and sent after reconnection.
- Refresh during failed submission or after a lost acknowledgement retains the
  original input and applies it once.
- Say Less scoring taps retain their operation ID across reload/retry. The last
  card closes the round and scores once even when its response is lost.
- A single-card Pass retry produces one event; a subsequent intentional Pass
  remains a new, valid action.
- Queued inputs from an expired turn or older round are explicitly rejected,
  controls recover, and the new context is not contaminated.
- Missed notifications and initial failed reads recover, including paused/manual
  phases. Slow old reads cannot replace a newer action response or resume read.
- Participants recover server expiry and the next turn with no facilitator
  browser present. Separate participant/facilitator contexts converge.
- Database write failures roll back and the queued input safely retries.
- Hung responses time out and release busy guards.
- An acknowledgement in one tab cannot erase another tab's pending input.
- Drafts/outboxes are scoped by participant, session, protocol, and display mode.
- A pinned shared screen refresh requests the display payload from its first
  read; private word/type fields stay absent.

Recovery assertions use a five-second deadline after availability returns or a
resume signal is delivered. This is a measured local acceptance target, not a
production SLA. Test teardown also checks for uncaught browser exceptions in
the gameplay scenarios. Screenshots cover 390px mobile and 1440px desktop views;
these are viewport checks, not real-device certification.

## Previous batch result and scope

Validated on this checkout on 2026-10-30. Run `npm run test:reliability` as well:
its 88 passing checks include 69 native database cases. The normal application
suite has 283 passing tests. The receipt is committed with the pile/score/public
state, not stored in a separate request.
The database suite also verifies that a card action blocked on a transaction
lock cannot score after the persisted deadline passes.

The protocol play-state recovery hook is adopted by SwitchCode and Say Less.
The shared SessionProvider now reconciles its consumers as well. Lobby status
also reconciles after missed notifications, and lifecycle navigation consumes the
provider's authoritative status. See the
[current local report](../../docs/local-reliability-results.md) for exact scope.
Other protocol adapters, production performance under polling, and hosted
Realtime/device rehearsals remain unverified. SwitchCode/Say Less lifecycle races
and complete workshops at varied headcounts have separate native database
coverage. Preserving drafts/outboxes across refresh requires
available browser storage. Unsent input that reaches the server after its valid
phase/deadline is rejected visibly; recovery does not change the game's deadlines.
Facilitator commands are not replayed automatically after an uncertain response.

Apply migrations 033–036 in order and verify schema before deployment. Follow the
[release instructions](../../docs/transactional-reliability-release.md).

## Current extension

The suite now also includes `remaining-recovery.test.mjs`, `wao-recovery.test.mjs`,
and `dibe-recovery.test.mjs`. These cover failed reads, missed events, scoped
input replay after offline refresh/lost acknowledgements, WAO concurrent tabs,
and DIBE scoring/timer recovery. All sockets are unavailable. Most additional
protocol cases use actual hook probes; actual form screens are tested for DIBE,
Truth Is, Rank and File, and IKWYM. See the extension report above for complete
counts, limits, and migrations 037/038. Default execution stays local.
