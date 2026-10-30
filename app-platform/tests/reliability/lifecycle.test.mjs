import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import pg from 'pg';
import { importApp, withRequestDatabase } from './runtime.mjs';
import { startPostgres, PostgresDatabase } from './postgres.mjs';
import { seedSwitchCode, seedSayLess, seedWorkshop, switchSnapshot, sayLessSnapshot } from './transaction-fixtures.mjs';

pg.types.setTypeParser(1184, (value) => new Date(value).toISOString());
const { startCodeSwitch } = await importApp('lib/protocols/code-switch/actions.ts');
const { startSayLess } = await importApp('lib/protocols/say-less/actions.ts');
const lobby = await importApp('app/(site)/session/[session_id]/lobby/actions.ts');
let cluster;
before(async () => { cluster = await startPostgres(); }, { timeout: 120000 });
after(async () => { await cluster?.close(); });
beforeEach(async () => { await cluster.pool.query('TRUNCATE test_control.failures'); });
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
const lead = (fixture, callback, database = cluster.database) => withRequestDatabase(database, fixture.players[0], callback);
async function start(fixture, database = cluster.database) {
  try { return await lead(fixture, () => lobby.startSessionAction(fixture.sessionId), database); }
  catch (error) { if (error.message.startsWith('NEXT_REDIRECT:')) return { ok: true }; throw error; }
}

for (const slug of ['code-switch', 'say-less']) {
  test(`R5 ${slug}: a delayed second start cannot erase an active workshop`, async () => {
    const fixture = slug === 'code-switch' ? await seedSwitchCode(cluster.pool) : await seedSayLess(cluster.pool);
    const snapshot = slug === 'code-switch' ? switchSnapshot : sayLessSnapshot;
    const before = await snapshot(cluster.pool, fixture);
    const result = await (slug === 'code-switch' ? startCodeSwitch : startSayLess)(cluster.database, fixture.sessionId);
    assert.equal(result.ok, false);
    assert.deepEqual(await snapshot(cluster.pool, fixture), before);
  });
}

test('R5 lobby action: a stale lobby read cannot clear a start that already won', async () => {
  const fixture = await seedWorkshop(cluster.pool, 'code-switch');
  await cluster.pool.query(`UPDATE sessions SET status='lobby' WHERE id=$1`, [fixture.sessionId]);
  const reached = deferred(); const release = deferred(); let held = false;
  const database = new PostgresDatabase(cluster.servicePool, { afterQuery: async (query) => {
    if (!held && query.table === 'sessions' && query.columns.includes('status')) { held = true; reached.resolve(); await release.promise; }
  } });
  const delayed = start(fixture, database);
  await reached.promise;
  try {
    assert.equal((await start(fixture)).ok, true);
    const before = (await cluster.pool.query('SELECT * FROM session_state WHERE session_id=$1', [fixture.sessionId])).rows[0];
    release.resolve();
    assert.ok((await delayed).error);
    assert.deepEqual((await cluster.pool.query('SELECT * FROM session_state WHERE session_id=$1', [fixture.sessionId])).rows[0], before);
  } finally { release.resolve(); await delayed; }
});

test('R3/R5 reset: a failed public-state reset preserves protocol rows and active status', async () => {
  const fixture = await seedSayLess(cluster.pool);
  const before = await sayLessSnapshot(cluster.pool, fixture);
  await cluster.pool.query(`INSERT INTO test_control.failures VALUES ('session_state:UPDATE')`);
  const result = await lead(fixture, () => lobby.returnToLobbyAction(fixture.sessionId));
  assert.ok(result.error);
  assert.deepEqual(await sayLessSnapshot(cluster.pool, fixture), before);
  assert.equal((await cluster.pool.query('SELECT status FROM sessions WHERE id=$1', [fixture.sessionId])).rows[0].status, 'active');
});

const one = async (sql, args) => (await cluster.pool.query(sql, args)).rows[0];
const reset = (fixture, version = 0) => cluster.database.rpc('reset_workshop_session', { p_session_id: fixture.sessionId, p_expected_version: version });
async function freshLobby(slug) { return seedWorkshop(cluster.pool, slug, { status: 'lobby' }); }

for (const slug of ['code-switch', 'say-less']) {
  test(`R5 ${slug}: two facilitator starts produce one complete active workshop`, async () => {
    const fixture = await freshLobby(slug);
    const results = await Promise.all([start(fixture), start(fixture)]);
    assert.equal(results.filter((result) => result.ok).length, 1);
    assert.equal(results.filter((result) => result.error).length, 1);
    const row = await one('SELECT status,lifecycle_version FROM sessions WHERE id=$1', [fixture.sessionId]);
    assert.deepEqual(row, { status: 'active', lifecycle_version: 1 });
    if (slug === 'code-switch') assert.equal((await one('SELECT count(*) FROM code_switch_rounds WHERE session_id=$1', [fixture.sessionId])).count, '1');
    else assert.equal((await one('SELECT count(*) FROM say_less_teams WHERE session_id=$1', [fixture.sessionId])).count, '2');
  });

  test(`R3/R5 ${slug}: failed activation rolls back preparation and leaves a retryable lobby`, async () => {
    const fixture = await freshLobby(slug);
    await cluster.pool.query(`INSERT INTO test_control.failures VALUES ('sessions:UPDATE')`);
    assert.ok((await start(fixture)).error);
    assert.equal((await one('SELECT status FROM sessions WHERE id=$1', [fixture.sessionId])).status, 'lobby');
    assert.equal((await one(`SELECT count(*) FROM ${slug === 'code-switch' ? 'code_switch_rounds' : 'say_less_teams'} WHERE session_id=$1`, [fixture.sessionId])).count, '0');
    await cluster.pool.query('TRUNCATE test_control.failures');
    assert.equal((await start(fixture)).ok, true);
  });

  test(`R3/R5 ${slug}: a failure after reset deletes still restores the entire active game`, async () => {
    const fixture = slug === 'code-switch' ? await seedSwitchCode(cluster.pool) : await seedSayLess(cluster.pool);
    const snapshot = slug === 'code-switch' ? switchSnapshot : sayLessSnapshot;
    const before = await snapshot(cluster.pool, fixture);
    await cluster.pool.query(`INSERT INTO test_control.failures VALUES ('sessions:UPDATE')`);
    assert.ok((await reset(fixture)).error);
    assert.deepEqual(await snapshot(cluster.pool, fixture), before);
    assert.equal((await one('SELECT status FROM sessions WHERE id=$1', [fixture.sessionId])).status, 'active');
  });

  test(`R5 ${slug}: duplicate old resets and delayed starts cannot touch a restarted generation`, async () => {
    const fixture = slug === 'code-switch' ? await seedSwitchCode(cluster.pool) : await seedSayLess(cluster.pool);
    const resets = await Promise.all([reset(fixture), reset(fixture)]);
    assert.equal(resets.filter((result) => result.data === true).length, 1);
    assert.equal((await start(fixture)).ok, true);
    const before = await one('SELECT * FROM session_state WHERE session_id=$1', [fixture.sessionId]);
    assert.equal((await reset(fixture, 0)).data, false);
    assert.deepEqual(await one('SELECT * FROM session_state WHERE session_id=$1', [fixture.sessionId]), before);
    assert.equal((await one('SELECT lifecycle_version FROM sessions WHERE id=$1', [fixture.sessionId])).lifecycle_version, 2);
  });
}

test('R5 cancel: a delayed Start cannot activate a cancelled lobby', async () => {
  const fixture = await freshLobby('code-switch'); const reached = deferred(); const release = deferred(); let held = false;
  const database = new PostgresDatabase(cluster.servicePool, { afterQuery: async (query) => {
    if (!held && query.table === 'sessions' && query.columns.includes('status')) { held = true; reached.resolve(); await release.promise; }
  } });
  const pending = start(fixture, database); await reached.promise;
  try {
    await cluster.pool.query(`UPDATE sessions SET status='cancelled' WHERE id=$1`, [fixture.sessionId]);
    release.resolve(); assert.ok((await pending).error);
    assert.equal((await one('SELECT status FROM sessions WHERE id=$1', [fixture.sessionId])).status, 'cancelled');
    assert.equal((await one('SELECT count(*) FROM code_switch_rounds WHERE session_id=$1', [fixture.sessionId])).count, '0');
  } finally { release.resolve(); await pending; }
});

test('R5 input: a delayed clue cannot enter a round created after reset/restart', async () => {
  const fixture = await seedSwitchCode(cluster.pool, { clues: [] });
  await cluster.pool.query('UPDATE code_switch_rounds SET write_started_at=clock_timestamp() WHERE id=$1', [fixture.roundId]);
  const reached = deferred(); const release = deferred();
  const database = { from: (...args) => cluster.database.from(...args), rpc: async (...args) => {
    if (args[0] === 'lock_code_switch_clue') { reached.resolve(); await release.promise; }
    return cluster.database.rpc(...args);
  } };
  const { dispatchCodeSwitchAction } = await importApp('lib/protocols/code-switch/actions.ts');
  const pending = dispatchCodeSwitchAction({ admin: database, sessionId: fixture.sessionId,
    participantId: fixture.players[1], isLead: false, action: { type: 'lockClue', text: 'orchard', roundId: fixture.roundId } });
  await reached.promise;
  try {
    assert.equal((await reset(fixture)).data, true); assert.equal((await start(fixture)).ok, true);
    release.resolve(); assert.equal((await pending).ok, false);
    assert.equal((await one(`SELECT count(*) FROM code_switch_clues c JOIN code_switch_rounds r ON r.id=c.round_id WHERE r.session_id=$1`, [fixture.sessionId])).count, '0');
  } finally { release.resolve(); await pending; }
});

test('R5 input: a delayed scoring tap cannot remove a card from a restarted Say Less workshop', async () => {
  const fixture = await seedSayLess(cluster.pool);
  const reached = deferred(); const release = deferred();
  const database = { from: (...args) => cluster.database.from(...args), rpc: async (...args) => {
    if (args[0] === 'commit_say_less_turn') { reached.resolve(); await release.promise; }
    return cluster.database.rpc(...args);
  } };
  const { dispatchSayLessAction } = await importApp('lib/protocols/say-less/actions.ts');
  const pending = dispatchSayLessAction({ admin: database, sessionId: fixture.sessionId,
    participantId: fixture.players[0], isLead: true, action: { type: 'cardAction', cardId: fixture.pile[0], outcome: 'got_it' } });
  await Promise.race([reached.promise, pending.then((result) => { throw new Error(`Input ended before commit: ${JSON.stringify(result)}`); })]);
  try {
    assert.equal((await reset(fixture)).data, true); assert.equal((await start(fixture)).ok, true);
    const before = await one('SELECT * FROM say_less_sessions WHERE session_id=$1', [fixture.sessionId]);
    release.resolve(); assert.equal((await pending).ok, false);
    assert.deepEqual(await one('SELECT * FROM say_less_sessions WHERE session_id=$1', [fixture.sessionId]), before);
    assert.equal((await one('SELECT count(*) FROM say_less_card_events e JOIN say_less_turns t ON t.id=e.turn_id WHERE t.session_id=$1', [fixture.sessionId])).count, '0');
  } finally { release.resolve(); await pending; }
});

test('R3 SwitchCode: failed next-round publication leaves the reveal intact and can be retried', async () => {
  const fixture = await seedSwitchCode(cluster.pool);
  await cluster.pool.query(`UPDATE code_switch_sessions SET phase='reveal' WHERE session_id=$1`, [fixture.sessionId]);
  const before = await switchSnapshot(cluster.pool, fixture);
  const { dispatchCodeSwitchAction } = await importApp('lib/protocols/code-switch/actions.ts');
  const next = () => dispatchCodeSwitchAction({ admin: cluster.database, sessionId: fixture.sessionId,
    participantId: fixture.players[0], isLead: true, action: { type: 'anotherRound' } });
  await cluster.pool.query(`INSERT INTO test_control.failures VALUES ('session_state:UPDATE')`);
  assert.equal((await next()).ok, false); assert.deepEqual(await switchSnapshot(cluster.pool, fixture), before);
  assert.equal((await one('SELECT count(*) FROM code_switch_rounds WHERE session_id=$1', [fixture.sessionId])).count, '1');
  await cluster.pool.query('TRUNCATE test_control.failures');
  assert.equal((await next()).ok, true);
});

for (const point of ['say_less_teams:UPDATE', 'say_less_previews:INSERT', 'session_state:UPDATE']) {
  test(`R3 Say Less: confirming teams rolls back every setup write at ${point}`, async () => {
    const fixture = await freshLobby('say-less'); await start(fixture);
    const { dispatchSayLessAction } = await importApp('lib/protocols/say-less/actions.ts');
    const confirm = () => dispatchSayLessAction({ admin: cluster.database, sessionId: fixture.sessionId,
      participantId: fixture.players[0], isLead: true, action: { type: 'confirmTeams' } });
    const teams = (await cluster.pool.query('SELECT * FROM say_less_teams WHERE session_id=$1 ORDER BY id', [fixture.sessionId])).rows;
    const row = await one('SELECT * FROM say_less_sessions WHERE session_id=$1', [fixture.sessionId]);
    await cluster.pool.query('INSERT INTO test_control.failures VALUES($1)', [point]);
    assert.equal((await confirm()).ok, false);
    assert.deepEqual((await cluster.pool.query('SELECT * FROM say_less_teams WHERE session_id=$1 ORDER BY id', [fixture.sessionId])).rows, teams);
    assert.deepEqual(await one('SELECT * FROM say_less_sessions WHERE session_id=$1', [fixture.sessionId]), row);
    assert.equal((await one('SELECT count(*) FROM say_less_previews WHERE session_id=$1', [fixture.sessionId])).count, '0');
    await cluster.pool.query('TRUNCATE test_control.failures'); assert.equal((await confirm()).ok, true);
  });
}

test('R5 Say Less: competing round starts create one turn and no orphan turns', async () => {
  const fixture = await seedSayLess(cluster.pool);
  await cluster.pool.query(`UPDATE say_less_sessions SET phase='ready',current_turn_id=NULL,phase_deadline=NULL WHERE session_id=$1`, [fixture.sessionId]);
  await cluster.pool.query('DELETE FROM say_less_turns WHERE id=$1', [fixture.turnId]);
  const { dispatchSayLessAction } = await importApp('lib/protocols/say-less/actions.ts');
  const next = () => dispatchSayLessAction({ admin: cluster.database, sessionId: fixture.sessionId,
    participantId: fixture.players[0], isLead: true, action: { type: 'startRound' } });
  const results = await Promise.all([next(), next()]);
  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal((await one('SELECT count(*) FROM say_less_turns WHERE session_id=$1', [fixture.sessionId])).count, '1');
});

test('R5 controls: a delayed facilitator command cannot act on a new round or turn', async () => {
  const code = await seedSwitchCode(cluster.pool);
  await cluster.pool.query(`UPDATE code_switch_sessions SET phase='reveal' WHERE session_id=$1`, [code.sessionId]);
  const { dispatchCodeSwitchAction } = await importApp('lib/protocols/code-switch/actions.ts');
  const invoke = (action) => dispatchCodeSwitchAction({ admin: cluster.database, sessionId: code.sessionId, participantId: code.players[0], isLead: true, action });
  assert.equal((await invoke({ type: 'anotherRound', roundId: code.roundId })).ok, true);
  const before = await one('SELECT * FROM code_switch_sessions WHERE session_id=$1', [code.sessionId]);
  assert.equal((await invoke({ type: 'wrap', roundId: code.roundId })).status, 409);
  assert.deepEqual(await one('SELECT * FROM code_switch_sessions WHERE session_id=$1', [code.sessionId]), before);
  const say = await seedSayLess(cluster.pool);
  const { dispatchSayLessAction } = await importApp('lib/protocols/say-less/actions.ts');
  const saved = await sayLessSnapshot(cluster.pool, say);
  assert.equal((await dispatchSayLessAction({ admin: cluster.database, sessionId: say.sessionId, participantId: say.players[0], isLead: true,
    action: { type: 'skipTurn', expectedVersion: 100, turnId: say.turnId } })).status, 409);
  assert.deepEqual(await sayLessSnapshot(cluster.pool, say), saved);
});

test('R2 isolation: concurrent workshops preserve their own inputs, scores and public notifications', async () => {
  const code = await seedSwitchCode(cluster.pool, { clues: [] });
  const say = await seedSayLess(cluster.pool, { lastCard: true });
  const control = await seedSwitchCode(cluster.pool); const unchanged = await switchSnapshot(cluster.pool, control);
  await cluster.pool.query('UPDATE code_switch_rounds SET write_started_at=clock_timestamp() WHERE id=$1', [code.roundId]);
  const { dispatchCodeSwitchAction } = await importApp('lib/protocols/code-switch/actions.ts');
  const { dispatchSayLessAction } = await importApp('lib/protocols/say-less/actions.ts');
  const results = await Promise.all([
    dispatchCodeSwitchAction({ admin: cluster.database, sessionId: code.sessionId, participantId: code.players[1], isLead: false,
      action: { type: 'lockClue', text: 'orchard', roundId: code.roundId } }),
    dispatchSayLessAction({ admin: cluster.database, sessionId: say.sessionId, participantId: say.players[0], isLead: true,
      action: { type: 'cardAction', cardId: say.pile[0], outcome: 'got_it' } }),
  ]);
  assert.ok(results.every((result) => result.ok));
  const a = await switchSnapshot(cluster.pool, code); const b = await sayLessSnapshot(cluster.pool, say);
  assert.equal(a.clues.length, 1); assert.equal(a.session.team_score, 0);
  assert.equal(b.events.length, 1); assert.equal(b.session.phase, 'round_break');
  assert.equal(a.pulse.state_json.sayLess, undefined); assert.equal(b.pulse.state_json.codeSwitch, undefined);
  assert.deepEqual(await switchSnapshot(cluster.pool, control), unchanged);
});

for (const slug of ['code-switch','say-less']) {
  test(`R3 ${slug}: completion and its public notification commit together`, async () => {
    const fixture = slug === 'code-switch' ? await seedSwitchCode(cluster.pool) : await seedSayLess(cluster.pool, { round: 2, lastCard: true });
    const { dispatchCodeSwitchAction, expireIfNeeded } = await importApp('lib/protocols/code-switch/actions.ts');
    const { dispatchSayLessAction } = await importApp('lib/protocols/say-less/actions.ts');
    const action = (payload) => (slug === 'code-switch' ? dispatchCodeSwitchAction : dispatchSayLessAction)({
      admin: cluster.database, sessionId: fixture.sessionId, participantId: fixture.players[0], isLead: true, action: payload });
    if (slug === 'code-switch') {
      await expireIfNeeded(cluster.database, fixture.sessionId);
      assert.equal((await action({ type: 'lockGuess', text: 'APPLE' })).ok, true);
      assert.equal((await action({ type: 'wrap' })).ok, true);
    } else assert.equal((await action({ type: 'cardAction', cardId: fixture.pile[0], outcome: 'got_it' })).ok, true);
    const before = await one('SELECT * FROM session_state WHERE session_id=$1', [fixture.sessionId]);
    const finish = () => action({ type: slug === 'code-switch' ? 'advanceRecap' : 'complete' });
    await cluster.pool.query(`INSERT INTO test_control.failures VALUES ('session_state:UPDATE')`);
    assert.equal((await finish()).ok, false);
    assert.equal((await one('SELECT status FROM sessions WHERE id=$1', [fixture.sessionId])).status, 'active');
    assert.deepEqual(await one('SELECT * FROM session_state WHERE session_id=$1', [fixture.sessionId]), before);
    await cluster.pool.query('TRUNCATE test_control.failures');
    assert.equal((await finish()).ok, true);
    assert.equal((await one('SELECT status FROM sessions WHERE id=$1', [fixture.sessionId])).status, 'completed');
  });
}
