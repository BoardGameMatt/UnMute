# Workshop reliability

The repository-root AGENTS.md continues to apply.

For changes to protocol actions, persistence, timers, session lifecycle, or
client synchronization, read `docs/workshop-reliability.md` first. It is the
authoritative engineering contract for workshop reliability. The protocol's
root-level spec remains authoritative for game mechanics; this contract does
not authorize changing those mechanics.

Map relevant changes to contract IDs and exercise the corresponding failure
scenarios. Run `npm run test:reliability` when changing these paths. Existing
failures are a remediation baseline, not permission to add regressions or to
claim the whole app is compliant. Include test results and coverage limits in
the handoff. Never weaken an invariant or mark a failing scenario skipped just
to obtain a green result.

The reliability suite requires Node 24. Its fast cases use isolated fake storage;
the transactional cases start a disposable native PostgreSQL server and execute
the checked-in migrations and application coordinators. Keep transaction/rollback
assertions on that real database rather than implementing SQL behavior in a fake.
For changes to protocol client synchronization or pending input, also
run `npm run test:browser`; see tests/browser/README.md for the real Chrome/native
PostgreSQL harness and coverage limits. Deployed schema, hosted Realtime delivery,
full screen/device rehearsals remain separate checks.

Shared session recovery depends on migration 035; atomic lifecycle/setup on 036.
The remaining implemented protocol adapters now use the 037 transaction boundary
and 038 DIBE/WAO guards and receipts. Read docs/remaining-protocol-reliability-results.md
for tested paths, required schema probes, and limits. Do not bypass a declared
transaction with a raw Supabase write or infer hosted guarantees from local tests.
