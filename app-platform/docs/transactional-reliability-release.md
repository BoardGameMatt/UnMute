# Workshop reliability release

The current app additionally requires migrations **037** and **038**, in order,
after 033–036 and before deployment. Run all four read-only schema probes via
`npm run verify:schema`, including `workshop_remaining_reliability_schema_ready`.
The [remaining protocol report](remaining-protocol-reliability-results.md) records
new fixes, coverage, and the hosted work still outstanding. New app files and
all required `@/` imports must be included when the developer commits this batch.
No hosted migration or deployment has been performed.

These changes preserve existing game decisions, scoring, and timing. The
server coordinators now call database functions that atomically persist each
affected operation. No production schema or data was modified during development.
Browser inputs now carry round/turn/version context and Say Less operation IDs;
the clients persist pending gameplay input for safe refresh/reconnect recovery.

## Required migration

Apply `supabase/migrations/033_atomic_workshop_transitions.sql` after the existing
migrations through 032, **before deploying the new application code**. It adds
functions only; it does not delete data or change existing table shapes. Then
apply `supabase/migrations/034_browser_input_recovery.sql` **before deploying the
browser recovery code**. Migration 034 adds two nullable card-event receipt
columns and a unique operation index, strengthens identical clue retries, and
replaces the Say Less commit function to save receipts in the same transaction.
Existing events remain unchanged, and older payloads are still supported.

For the current shared-session/lifecycle changes, also apply
`035_session_snapshot_revision.sql` followed by `036_workshop_lifecycle.sql`
before deploying. These add the snapshot revision/trigger, parent generation,
and atomic start/reset/setup/progression functions. Run the new read-only
`workshop_session_reliability_schema_ready` probe as part of `npm run verify:schema`.
See [the local verification report](local-reliability-results.md) for scope and
the remaining legacy protocol paths. Do not deploy the current app with only 034.

The functions commit SwitchCode round/clue results, phase, score, and public state
together; and Say Less pile, score event, turn ending, phase/version, and public
state together. Clue filters, guess matching, card outcomes, turn limits, and
round rules remain owned by the TypeScript engines/coordinators.

Run `npm run verify:schema` with the intended environment. It now requires the
read-only `workshop_transaction_schema_ready`,
`workshop_browser_recovery_schema_ready`, and
`workshop_session_reliability_schema_ready` RPCs to return true. Alternatively,
run `supabase/verify-schema.sql` in the Supabase SQL editor. Both checks include
the new functions; the SQL audit also covers the prerequisite tables, receipt
columns, and unique operation index.
Do not deploy this code against a schema missing 033–036; there is intentionally no
fallback to the partial-write implementation.

Then follow [the production deployment procedure](../../docs/production-deploy.md):
build from committed files, confirm the **unmute-app** Production deployment is
Ready, and smoke-test the affected flows before sharing host links or join codes.
Use a deployment window outside active workshops so old and new server writers
are not treated as though they share the same transactional contract.

## Verification available locally

```powershell
cd app-platform
npm ci
npm test
npm run test:reliability
npm run test:browser
npx tsc --noEmit --incremental false
npm run build
```

The reliability suite requires Node 24 and includes a disposable native
PostgreSQL 17.9 server. It applies actual dependency migrations through 036, invokes
actual application coordinators as the service role, injects database write
errors, and tests rollback/retry and separate concurrent connections. It does
not accept an external database URL or read production credentials. The cluster
is stopped and removed afterward. Its fault triggers live only in the tests and
are not part of the production migrations.

The browser suite also requires installed Chrome and runs real screens, hooks,
API handlers, and PostgreSQL with notifications absent. It checks offline input,
refresh, lost acknowledgements, stale responses, and recovery without the lead.
See [the browser coverage notes](../tests/browser/README.md). Hosted PostgREST,
Auth, production schema, hosted Realtime, device suspension, and human workshop
rehearsals still require separate checks. Complete local coordinator/database
simulations cover SwitchCode and Say Less at three headcounts. The test page
shell is not Next SSR.

## Smoke tests after deployment

- SwitchCode: lock clues, confirm the existing Assemble/Disperse filter and timer,
  submit a correct guess and a miss, and verify one score update and the reveal.
- Say Less: mark a correct card, pass in round two, let a turn expire, skip a turn,
  and finish the last card of each round. Confirm points, pile, and phase agree.
- Refresh a second participant after each transition to verify the persisted
  result independently of the screen that submitted the action.
- Disconnect a participant, submit an input, reconnect, and confirm one accepted
  result or an explicit expired-input rejection. Refresh during submission.
- Check the shared-screen pin survives refresh. Leave a second participant open
  in a paused/manual phase, advance from the lead, and confirm it catches up.

If the application must be rolled back, leave the additive SQL changes in place
and restore the prior application deployment through the normal release process.
That restores the prior reliability risks, so do not resume workshops on the
assumption that rollback preserves the transactional fixes.
