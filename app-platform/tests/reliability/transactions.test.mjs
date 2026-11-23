import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { importApp, appRoot } from './runtime.mjs';
import { startPostgres, PostgresDatabase } from './postgres.mjs';
import { seedSwitchCode, seedSayLess, switchSnapshot, sayLessSnapshot } from './transaction-fixtures.mjs';

pg.types.setTypeParser(1184, (value) => new Date(value).toISOString());
const { expireIfNeeded, dispatchCodeSwitchAction } = await importApp('lib/protocols/code-switch/actions.ts');
const { dispatchSayLessAction, advanceIfDue } = await importApp('lib/protocols/say-less/actions.ts');
let cluster;
before(async () => {
  cluster = await startPostgres();
  const { rows: [version] } = await cluster.pool.query('SELECT version()');
  console.log(`Transactional tests: ${version.version}`);
}, { timeout: 120000 });
after(async () => { await cluster?.close(); });
beforeEach(async () => { await cluster.pool.query('TRUNCATE test_control.failures'); });
const fault = async (point) => cluster.pool.query('INSERT INTO test_control.failures VALUES ($1)', [point]);
const clearFault = async () => cluster.pool.query('TRUNCATE test_control.failures');
const switchAction = (fixture, action, database = cluster.database) => dispatchCodeSwitchAction({
  admin: database, sessionId: fixture.sessionId, participantId: fixture.players[0], isLead: true, action,
});
const cardAction = (fixture, outcome = 'got_it', database = cluster.database) => dispatchSayLessAction({
  admin: database, sessionId: fixture.sessionId, participantId: fixture.players[0], isLead: true,
  action: { type: 'cardAction', cardId: fixture.pile[0], outcome },
});

// These are the original two regression contracts, now exercised against real
// PostgreSQL writes and test-only AFTER triggers that fail inside the RPC.
test('R3 SwitchCode: a failed transition leaves the old phase intact or the new phase complete', async () => {
  const fixture = await seedSwitchCode(cluster.pool);
  const before = await switchSnapshot(cluster.pool, fixture);
  await fault('code_switch_rounds:UPDATE');
  await assert.rejects(expireIfNeeded(cluster.database, fixture.sessionId), /Injected storage failure/);
  assert.deepEqual(await switchSnapshot(cluster.pool, fixture), before);
  await clearFault();
  await expireIfNeeded(cluster.database, fixture.sessionId);
  const after = await switchSnapshot(cluster.pool, fixture);
  assert.equal(after.session.phase, 'guess');
  assert.ok(after.round.guess_started_at);
  assert.deepEqual(after.round.filtered_clues_json, ['red']);
  assert.equal(after.pulse.phase, 'guess');
});

test('R3/R8 Say Less: an acknowledged correct card cannot lose its score event', async () => {
  const fixture = await seedSayLess(cluster.pool);
  const before = await sayLessSnapshot(cluster.pool, fixture);
  await fault('say_less_card_events:INSERT');
  const failed = await cardAction(fixture);
  assert.equal(failed.ok, false);
  assert.match(failed.error, /Injected storage failure/);
  assert.deepEqual(await sayLessSnapshot(cluster.pool, fixture), before);
  await clearFault();
  assert.equal((await cardAction(fixture)).ok, true);
  const after = await sayLessSnapshot(cluster.pool, fixture);
  assert.deepEqual(after.session.pile_card_ids, [fixture.pile[1]]);
  assert.equal(after.events.length, 1);
  assert.equal(after.events[0].outcome, 'got_it');
  assert.equal(after.session.version, 1);
});

for (const point of ['code_switch_clues:UPDATE', 'code_switch_sessions:UPDATE', 'session_state:UPDATE']) {
  test(`R3 SwitchCode: ${point} failure rolls back the entire write-to-guess transition`, async () => {
    const fixture = await seedSwitchCode(cluster.pool, { type: 'shared' });
    const before = await switchSnapshot(cluster.pool, fixture);
    await fault(point);
    await assert.rejects(expireIfNeeded(cluster.database, fixture.sessionId), /Injected storage failure/);
    assert.deepEqual(await switchSnapshot(cluster.pool, fixture), before);
    await clearFault();
    await expireIfNeeded(cluster.database, fixture.sessionId);
    assert.deepEqual((await switchSnapshot(cluster.pool, fixture)).round.filtered_clues_json, ['fruit']);
  });
}

for (const point of ['code_switch_rounds:UPDATE', 'code_switch_sessions:UPDATE', 'session_state:UPDATE']) {
  test(`R3/R8 SwitchCode: ${point} failure preserves the guess and score for a safe retry`, async () => {
    const fixture = await seedSwitchCode(cluster.pool);
    await expireIfNeeded(cluster.database, fixture.sessionId);
    const before = await switchSnapshot(cluster.pool, fixture);
    await fault(point);
    await assert.rejects(switchAction(fixture, { type: 'lockGuess', text: 'APPLE' }), /Injected storage failure/);
    assert.deepEqual(await switchSnapshot(cluster.pool, fixture), before);
    await clearFault();
    assert.equal((await switchAction(fixture, { type: 'lockGuess', text: 'APPLE' })).ok, true);
    const after = await switchSnapshot(cluster.pool, fixture);
    assert.equal(after.session.team_score, 1);
    assert.equal(after.round.is_hit, true);
    assert.equal(after.session.phase, 'reveal');
  });
}

test('R2/R8 SwitchCode: independent connections resolve one guess and award one point', async () => {
  const fixture = await seedSwitchCode(cluster.pool);
  await expireIfNeeded(cluster.database, fixture.sessionId);
  const first = await cluster.servicePool.connect();
  const second = await cluster.servicePool.connect();
  try {
    assert.notEqual(first.processID, second.processID);
    const results = await Promise.all([
      switchAction(fixture, { type: 'lockGuess', text: 'APPLE' }, new PostgresDatabase(first)),
      switchAction(fixture, { type: 'lockGuess', text: 'APPLE' }, new PostgresDatabase(second)),
    ]);
    assert.ok(results.some((result) => result.ok));
    assert.equal((await switchSnapshot(cluster.pool, fixture)).session.team_score, 1);
  } finally { first.release(); second.release(); }
});

test('R2 SwitchCode: a new clue between calculation and commit forces the filter to be recomputed', async () => {
  const fixture = await seedSwitchCode(cluster.pool, { clues: ['fruit', 'fruit'] });
  const database = new PostgresDatabase(cluster.servicePool);
  const rpc = database.rpc.bind(database);
  let inserted = false;
  database.rpc = async (name, args) => {
    if (name === 'commit_code_switch_transition' && !inserted) {
      inserted = true;
      assert.equal((await rpc('lock_code_switch_clue', { p_session_id: fixture.sessionId,
        p_round_id: fixture.roundId, p_participant_id: fixture.players[3], p_raw_text: 'red', p_normalized: 'red' })).data, true);
    }
    return rpc(name, args);
  };
  await expireIfNeeded(database, fixture.sessionId);
  assert.deepEqual((await switchSnapshot(cluster.pool, fixture)).round.filtered_clues_json, ['red']);
});

test('R4 SwitchCode: timeout still counts as a miss and a disconnected guesser still abandons without scoring', async () => {
  const timeout = await seedSwitchCode(cluster.pool);
  await expireIfNeeded(cluster.database, timeout.sessionId);
  await cluster.pool.query(`UPDATE public.code_switch_rounds SET guess_started_at = clock_timestamp() - interval '70 seconds' WHERE id = $1`, [timeout.roundId]);
  await expireIfNeeded(cluster.database, timeout.sessionId);
  let saved = await switchSnapshot(cluster.pool, timeout);
  assert.equal(saved.round.end_reason, 'timer');
  assert.equal(saved.session.team_score, 0);
  const abandoned = await seedSwitchCode(cluster.pool);
  await cluster.pool.query('UPDATE public.session_participants SET connected = false WHERE participant_id = $1', [abandoned.players[0]]);
  await expireIfNeeded(cluster.database, abandoned.sessionId);
  saved = await switchSnapshot(cluster.pool, abandoned);
  assert.equal(saved.round.end_reason, 'abandoned');
  assert.equal(saved.session.team_score, 0);
  assert.equal(saved.pulse.state_json.codeSwitch.abandoned, true);
});

for (const point of ['say_less_sessions:UPDATE', 'say_less_card_events:INSERT', 'say_less_turns:UPDATE', 'session_state:UPDATE']) {
  test(`R3/R8 Say Less: ${point} failure rolls back last-card scoring and round closure`, async () => {
    const fixture = await seedSayLess(cluster.pool, { lastCard: true });
    const before = await sayLessSnapshot(cluster.pool, fixture);
    await fault(point);
    assert.equal((await cardAction(fixture)).ok, false);
    assert.deepEqual(await sayLessSnapshot(cluster.pool, fixture), before);
    await clearFault();
    assert.equal((await cardAction(fixture)).ok, true);
    const after = await sayLessSnapshot(cluster.pool, fixture);
    assert.equal(after.session.phase, 'round_break');
    assert.ok(after.turn.ended_at);
    assert.equal(after.turn.end_reason, 'pile_empty');
    assert.equal(after.events.filter((event) => event.outcome === 'got_it').length, 1);
  });
}

test('R8 Say Less: the final card of round two commits final scores and exactly one point', async () => {
  const fixture = await seedSayLess(cluster.pool, { round: 2, lastCard: true });
  assert.equal((await cardAction(fixture)).ok, true);
  const saved = await sayLessSnapshot(cluster.pool, fixture);
  assert.equal(saved.session.phase, 'final_scores');
  assert.deepEqual(saved.session.pile_card_ids, []);
  assert.equal(saved.events.length, 1);
  assert.equal(saved.pulse.phase, 'final_scores');
});

test('R2/R8 Say Less: competing connections cannot score the same card twice', async () => {
  const fixture = await seedSayLess(cluster.pool);
  const first = await cluster.servicePool.connect();
  const second = await cluster.servicePool.connect();
  try {
    assert.notEqual(first.processID, second.processID);
    const result = await Promise.all([cardAction(fixture, 'got_it', new PostgresDatabase(first)), cardAction(fixture, 'got_it', new PostgresDatabase(second))]);
    assert.equal(result.filter((item) => item.ok).length, 1);
    const saved = await sayLessSnapshot(cluster.pool, fixture);
    assert.equal(saved.events.length, 1);
    assert.equal(saved.session.version, 1);
  } finally { first.release(); second.release(); }
});

test('R1/R8 Say Less: replay after losing the RPC acknowledgement has no second effect', async () => {
  const fixture = await seedSayLess(cluster.pool);
  const args = { p_session_id: fixture.sessionId, p_expected_version: 0, p_turn_id: fixture.turnId,
    p_patch: { pile_card_ids: [fixture.pile[1]] }, p_event: { cardId: fixture.pile[0], outcome: 'got_it' }, p_end_reason: null };
  assert.equal((await cluster.database.rpc('commit_say_less_turn', args)).data, true);
  const before = await sayLessSnapshot(cluster.pool, fixture);
  assert.equal((await cluster.database.rpc('commit_say_less_turn', args)).data, false);
  assert.deepEqual(await sayLessSnapshot(cluster.pool, fixture), before);
});

test('R4 Say Less: timeout rotates the unscored card and the tenth ended turn pauses hold', async () => {
  const fixture = await seedSayLess(cluster.pool, { endedTurns: 9 });
  await cluster.pool.query(`UPDATE public.say_less_sessions SET phase_deadline = clock_timestamp() - interval '1 second' WHERE session_id = $1`, [fixture.sessionId]);
  await advanceIfDue(cluster.database, fixture.sessionId);
  const saved = await sayLessSnapshot(cluster.pool, fixture);
  assert.equal(saved.session.phase, 'hold');
  assert.equal(saved.session.paused, true);
  assert.equal(saved.session.phase_deadline, null);
  assert.deepEqual(saved.session.pile_card_ids, [fixture.pile[1], fixture.pile[0]]);
  assert.equal(saved.events[0].outcome, 'expired');
  assert.equal(saved.turn.end_reason, 'timer');
});

test('R8 Say Less: pass stays forbidden in round one and rotates without points in round two', async () => {
  const first = await seedSayLess(cluster.pool);
  const before = await sayLessSnapshot(cluster.pool, first);
  assert.equal((await cardAction(first, 'pass')).status, 400);
  assert.deepEqual(await sayLessSnapshot(cluster.pool, first), before);
  const second = await seedSayLess(cluster.pool, { round: 2 });
  assert.equal((await cardAction(second, 'pass')).ok, true);
  const after = await sayLessSnapshot(cluster.pool, second);
  assert.deepEqual(after.session.pile_card_ids, [second.pile[1], second.pile[0]]);
  assert.equal(after.events[0].outcome, 'pass');
  assert.equal(after.turn.ended_at, null);
});

test('Migrations 033/034 are replayable and schema probes are read-only and service-role executable', async () => {
  await cluster.pool.query(await readFile(join(appRoot, 'supabase/migrations/033_atomic_workshop_transitions.sql'), 'utf8'));
  await cluster.pool.query(await readFile(join(appRoot, 'supabase/migrations/034_browser_input_recovery.sql'), 'utf8'));
  await cluster.pool.query(await readFile(join(appRoot, 'supabase/migrations/035_session_snapshot_revision.sql'), 'utf8'));
  await cluster.pool.query(await readFile(join(appRoot, 'supabase/migrations/036_workshop_lifecycle.sql'), 'utf8'));
  assert.equal((await cluster.database.rpc('workshop_transaction_schema_ready')).data, true);
  assert.equal((await cluster.database.rpc('workshop_browser_recovery_schema_ready')).data, true);
  const { rows: [privileges] } = await cluster.pool.query(`SELECT
    has_function_privilege('anon','public.commit_say_less_turn(uuid,integer,uuid,jsonb,jsonb,text)','EXECUTE') AS anon,
    has_function_privilege('service_role','public.commit_say_less_turn(uuid,integer,uuid,jsonb,jsonb,text)','EXECUTE') AS service`);
  assert.equal(privileges.anon, false);
  assert.equal(privileges.service, true);
});

test('R2 SwitchCode: a stale round cannot advance a newer round in the same phase', async () => {
  const fixture = await seedSwitchCode(cluster.pool);
  const before = await switchSnapshot(cluster.pool, fixture);
  const result = await cluster.database.rpc('commit_code_switch_transition', {
    p_session_id: fixture.sessionId, p_round_id: fixture.wordId,
    p_expected_phase: 'write', p_next_phase: 'guess',
    p_round_patch: { guess_started_at: new Date().toISOString() }, p_clues: [], p_score_delta: 0, p_extra: {},
  });
  assert.equal(result.data, false);
  assert.equal(result.error, null);
  assert.deepEqual(await switchSnapshot(cluster.pool, fixture), before);
});

test('R3 SwitchCode: a failed public-state notification also rolls back clue admission', async () => {
  const fixture = await seedSwitchCode(cluster.pool, { clues: [] });
  // Keep writing open so the request exercises clue admission, not expiry.
  await cluster.pool.query('UPDATE public.code_switch_rounds SET write_started_at = clock_timestamp() WHERE id = $1', [fixture.roundId]);
  const args = { p_session_id: fixture.sessionId, p_round_id: fixture.roundId,
    p_participant_id: fixture.players[1], p_raw_text: 'fruit', p_normalized: 'fruit' };
  const before = await switchSnapshot(cluster.pool, fixture);
  await fault('session_state:UPDATE');
  assert.match((await cluster.database.rpc('lock_code_switch_clue', args)).error.message, /Injected storage failure/);
  assert.deepEqual(await switchSnapshot(cluster.pool, fixture), before);
  await clearFault();
  assert.equal((await cluster.database.rpc('lock_code_switch_clue', args)).data, true);
  assert.equal((await cluster.database.rpc('lock_code_switch_clue', args)).data, true);
  assert.equal((await switchSnapshot(cluster.pool, fixture)).clues.length, 1);
  await expireIfNeeded(cluster.database, fixture.sessionId);
  // Force closure through the coordinator, then confirm late clues cannot enter.
  await cluster.pool.query(`UPDATE public.code_switch_rounds SET write_started_at = clock_timestamp() - interval '10 minutes' WHERE id = $1`, [fixture.roundId]);
  await expireIfNeeded(cluster.database, fixture.sessionId);
  assert.equal((await cluster.database.rpc('lock_code_switch_clue', { ...args, p_participant_id: fixture.players[2] })).data, false);
  assert.equal((await switchSnapshot(cluster.pool, fixture)).clues.length, 1);
});

test('R8 Say Less: skip still closes the turn without awarding points', async () => {
  const fixture = await seedSayLess(cluster.pool);
  const result = await dispatchSayLessAction({ admin: cluster.database, sessionId: fixture.sessionId,
    participantId: fixture.players[0], isLead: true, action: { type: 'skipTurn' } });
  assert.equal(result.ok, true);
  const saved = await sayLessSnapshot(cluster.pool, fixture);
  assert.equal(saved.session.phase, 'hold');
  assert.equal(saved.turn.end_reason, 'skipped');
  assert.equal(saved.events[0].outcome, 'expired');
  assert.equal(saved.session.last_turn_got_it, 0);
});

test('R8 Say Less: facilitator can end a round early from hold and preserve earned points', async () => {
  const fixture = await seedSayLess(cluster.pool);
  assert.equal((await cardAction(fixture)).ok, true);
  await dispatchSayLessAction({ admin: cluster.database, sessionId: fixture.sessionId,
    participantId: fixture.players[0], isLead: true, action: { type: 'skipTurn' } });
  const result = await dispatchSayLessAction({ admin: cluster.database, sessionId: fixture.sessionId,
    participantId: fixture.players[0], isLead: true, action: { type: 'endRound' } });
  assert.equal(result.ok, true);
  const saved = await sayLessSnapshot(cluster.pool, fixture);
  assert.equal(saved.session.phase, 'round_break');
  assert.equal(saved.session.round_1_ended_early, true);
  assert.equal(saved.events.filter((event) => event.outcome === 'got_it').length, 1);
});

test('Schema verification detects a missing transaction RPC without issuing gameplay writes', async () => {
  const audit = await readFile(join(appRoot, 'supabase/verify-schema.sql'), 'utf8');
  const client = await cluster.pool.connect();
  try {
    assert.equal((await client.query(audit)).rows.filter((row) => row.migration === '033_atomic_workshop_transitions.sql').length, 0);
    await client.query('BEGIN');
    await client.query('DROP FUNCTION public.commit_say_less_turn(uuid,integer,uuid,jsonb,jsonb,text)');
    assert.equal((await client.query('SELECT public.workshop_transaction_schema_ready() AS ready')).rows[0].ready, false);
    const missing = (await client.query(audit)).rows.filter((row) => row.migration === '033_atomic_workshop_transitions.sql');
    assert.equal(missing.length, 1);
    assert.match(missing[0].object_name, /^commit_say_less_turn/);
  } finally { await client.query('ROLLBACK'); client.release(); }
});

const recoverableCard = (fixture, changes = {}) => ({ type: 'cardAction', cardId: fixture.pile[0],
  outcome: 'got_it', operationId: randomUUID(), turnId: fixture.turnId, expectedVersion: 0, ...changes });
const savedCard = (fixture, action, database = cluster.database) => dispatchSayLessAction({ admin: database,
  sessionId: fixture.sessionId, participantId: fixture.players[0], isLead: true, action });

for (const point of ['say_less_sessions:UPDATE', 'say_less_card_events:INSERT', 'session_state:UPDATE']) {
  test(`R1/R3: card receipt rolls back with the pile and score at ${point}`, async () => {
    const fixture = await seedSayLess(cluster.pool);
    const action = recoverableCard(fixture);
    const before = await sayLessSnapshot(cluster.pool, fixture);
    await fault(point);
    assert.equal((await savedCard(fixture, action)).ok, false);
    assert.deepEqual(await sayLessSnapshot(cluster.pool, fixture), before);
    assert.equal((await cluster.pool.query('SELECT count(*) FROM say_less_card_events WHERE operation_id=$1', [action.operationId])).rows[0].count, '0');
    await clearFault();
    assert.equal((await savedCard(fixture, action)).ok, true);
    const committed = await sayLessSnapshot(cluster.pool, fixture);
    assert.equal(committed.events[0].operation_id, action.operationId);
    assert.equal(committed.events[0].operation_version, 0);
    assert.equal((await savedCard(fixture, action)).ok, true);
    assert.deepEqual(await sayLessSnapshot(cluster.pool, fixture), committed);
  });
}

test('R1/R2: concurrent copies of one card operation commit one receipt and one score', async () => {
  const fixture = await seedSayLess(cluster.pool);
  const action = recoverableCard(fixture);
  const a = await cluster.servicePool.connect(); const b = await cluster.servicePool.connect();
  try {
    const results = await Promise.all([savedCard(fixture, action, new PostgresDatabase(a)), savedCard(fixture, action, new PostgresDatabase(b))]);
    assert.ok(results.every((result) => result.ok), JSON.stringify(results));
    const snapshot = await sayLessSnapshot(cluster.pool, fixture);
    assert.equal(snapshot.events.length, 1); assert.equal(snapshot.session.version, 1);
  } finally { a.release(); b.release(); }
});

test('R1 Say Less: an identical retry committed after its first receipt lookup is acknowledged', async () => {
  const fixture = await seedSayLess(cluster.pool), action = recoverableCard(fixture);
  let interleaved = false;
  const database = new PostgresDatabase(cluster.servicePool, { afterQuery: async (query, result) => {
    if (interleaved || query.table !== 'say_less_card_events' || query.operation !== 'select' || result.data) return;
    interleaved = true;
    assert.equal((await savedCard(fixture, action)).ok, true);
  } });
  const result = await savedCard(fixture, action, database);
  assert.equal(interleaved, true); assert.equal(result.ok, true, JSON.stringify(result));
  const snapshot = await sayLessSnapshot(cluster.pool, fixture);
  assert.equal(snapshot.events.length, 1); assert.equal(snapshot.session.version, 1);
});

test('R1: reusing a card operation ID with a conflicting payload is rejected', async () => {
  const fixture = await seedSayLess(cluster.pool, { round: 2, lastCard: true });
  const action = recoverableCard(fixture, { outcome: 'pass' });
  assert.equal((await savedCard(fixture, action)).ok, true);
  const before = await sayLessSnapshot(cluster.pool, fixture);
  assert.equal((await savedCard(fixture, { ...action, outcome: 'got_it' })).status, 409);
  assert.deepEqual(await sayLessSnapshot(cluster.pool, fixture), before);
  assert.equal((await savedCard(fixture, { ...action, operationId: randomUUID(), expectedVersion: 1 })).ok, true);
  assert.equal((await sayLessSnapshot(cluster.pool, fixture)).events.length, 2, 'A new intentional pass remains valid');
});

test('R1: SwitchCode acknowledges only the identical locked clue', async () => {
  const fixture = await seedSwitchCode(cluster.pool, { clues: [] });
  await cluster.pool.query('UPDATE code_switch_rounds SET write_started_at=clock_timestamp() WHERE id=$1', [fixture.roundId]);
  const args = { p_session_id: fixture.sessionId, p_round_id: fixture.roundId,
    p_participant_id: fixture.players[1], p_raw_text: 'orchard', p_normalized: 'orchard' };
  assert.equal((await cluster.database.rpc('lock_code_switch_clue', args)).data, true);
  const before = await switchSnapshot(cluster.pool, fixture);
  assert.equal((await cluster.database.rpc('lock_code_switch_clue', { ...args, p_raw_text: 'tree', p_normalized: 'tree' })).data, false);
  assert.deepEqual(await switchSnapshot(cluster.pool, fixture), before);
});

test('Schema verification detects a missing browser recovery index without writing gameplay data', async () => {
  const audit = await readFile(join(appRoot, 'supabase/verify-schema.sql'), 'utf8');
  const client = await cluster.pool.connect();
  try {
    assert.equal((await client.query(audit)).rows.filter((row) => row.migration === '034_browser_input_recovery.sql').length, 0);
    await client.query('BEGIN');
    await client.query('DROP INDEX public.say_less_card_operation_once');
    assert.equal((await client.query('SELECT public.workshop_browser_recovery_schema_ready() AS ready')).rows[0].ready, false);
    const missing = (await client.query(audit)).rows.filter((row) => row.migration === '034_browser_input_recovery.sql');
    assert.equal(missing.length, 1); assert.equal(missing[0].kind, 'unique_index');
  } finally { await client.query('ROLLBACK'); client.release(); }
});

test('R4/R1: a queued card input waiting for the transaction lock cannot score past its deadline', async () => {
  const fixture = await seedSayLess(cluster.pool);
  const action = recoverableCard(fixture);
  const blocker = await cluster.pool.connect();
  let atCommit;
  const arrived = new Promise((resolve) => { atCommit = resolve; });
  const database = { from: (...args) => cluster.database.from(...args),
    rpc: (...args) => { atCommit(); return cluster.database.rpc(...args); } };
  let result;
  try {
    await blocker.query('BEGIN');
    await blocker.query('SELECT 1 FROM say_less_sessions WHERE session_id=$1 FOR UPDATE', [fixture.sessionId]);
    result = savedCard(fixture, action, database);
    await Promise.race([arrived, result.then(() => { throw new Error('Action ended before reaching the transaction'); })]);
    // Move the fixture's deadline while the real RPC waits for the row lock.
    await blocker.query(`UPDATE say_less_sessions SET phase_deadline=clock_timestamp()-interval '1 second' WHERE session_id=$1`, [fixture.sessionId]);
    await blocker.query('COMMIT');
    assert.equal((await result).status, 409);
    const snapshot = await sayLessSnapshot(cluster.pool, fixture);
    assert.equal(snapshot.events.length, 0); assert.deepEqual(snapshot.session.pile_card_ids, fixture.pile);
    assert.equal(snapshot.session.version, 0);
    await advanceIfDue(cluster.database, fixture.sessionId);
    assert.equal((await sayLessSnapshot(cluster.pool, fixture)).session.phase, 'hold');
  } finally { await blocker.query('ROLLBACK'); blocker.release(); await result; }
});
