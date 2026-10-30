import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import pg from 'pg';
import { startPostgres, PostgresDatabase } from './postgres.mjs';
import { seedWorkshop } from './transaction-fixtures.mjs';
import { importApp, withRequestDatabase } from './runtime.mjs';
import { readFile } from 'node:fs/promises';
import { appRoot } from './runtime.mjs';
import { join } from 'node:path';

pg.types.setTypeParser(1184, (value) => new Date(value).toISOString());
const { POST } = await importApp('app/api/session/[id]/action/route.ts');
const engine = await importApp('lib/protocols/draw-it-by-ear/engine.ts');
let cluster;
before(async () => {
  cluster = await startPostgres();
  await cluster.pool.query(`INSERT INTO protocols(slug,name,type,min_players,max_players)
    VALUES ('draw-it-by-ear','Draw It By Ear','realtime',5,20) ON CONFLICT(slug) DO NOTHING`);
}, { timeout: 120000 });
after(async () => { await cluster?.close(); });
const snapshot = async (fixture) => (await cluster.pool.query('SELECT * FROM session_state WHERE session_id=$1', [fixture.sessionId])).rows[0];
const request = (fixture, actionType, payload, generation, database = cluster.database) => withRequestDatabase(database, fixture.players[0], () => POST(
  new Request('http://local.invalid/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType, payload, generation }) }), { params: { id: fixture.sessionId } }));

test('R6 database revision is monotonic across JSON resets and ignores caller-supplied revisions', async () => {
  const fixture = await seedWorkshop(cluster.pool, 'code-switch');
  const before = Number((await snapshot(fixture)).revision);
  await cluster.pool.query(`UPDATE session_state SET revision=0,state_json='{"write_revision":0}' WHERE session_id=$1`, [fixture.sessionId]);
  assert.equal(Number((await snapshot(fixture)).revision), before + 1);
  await cluster.pool.query(`UPDATE session_state SET state_json='{}' WHERE session_id=$1`, [fixture.sessionId]);
  assert.equal(Number((await snapshot(fixture)).revision), before + 2);
});

test('R5 generic handler rejects a client action from a previous workshop generation', async () => {
  const fixture = await seedWorkshop(cluster.pool, 'code-switch');
  await cluster.pool.query('UPDATE sessions SET lifecycle_version=2 WHERE id=$1', [fixture.sessionId]);
  const before = await snapshot(fixture);
  assert.equal((await request(fixture, 'testInput', { choice: 'old' }, 0)).status, 409);
  assert.deepEqual(await snapshot(fixture), before);
});

test('R2 generic handler cannot silently overwrite an accepted independent input', async () => {
  const fixture = await seedWorkshop(cluster.pool, 'code-switch');
  let reached; const bothRead = new Promise((done) => { reached = done; }); let release; const gate = new Promise((done) => { release = done; }); let count = 0;
  const database = new PostgresDatabase(cluster.servicePool, { afterQuery: async (query) => {
    if (query.table === 'session_state' && query.operation === 'select') { if (++count === 2) reached(); await gate; }
  } });
  const pending = ['one','two'].map((value) => request(fixture, 'testInput', { [value]: true }, 0, database));
  await bothRead; release();
  const results = await Promise.all(pending);
  assert.deepEqual(results.map((response) => response.status).sort(), [200,409]);
  const saved = (await snapshot(fixture)).state_json;
  assert.equal(Object.keys(saved).length, 1);
});

test('R5 DIBE: reset/reinitialize cannot reuse a JSON revision to admit a delayed old action', async () => {
  const fixture = await seedWorkshop(cluster.pool, 'draw-it-by-ear', { headcount: 5 });
  const people = fixture.players.map((id, n) => ({ id, display_name: `Player ${n}` }));
  const catalog = [{ id: 'test-image', name: 'Test image', criteria: [{ text: 'A circle', points: 1 }] }];
  const initial = { ...engine.initializeGame(people, catalog, fixture.players[0]), write_revision: 1 };
  await cluster.pool.query('UPDATE session_state SET state_json=$1,phase=$2 WHERE session_id=$3', [JSON.stringify(initial), initial.phase, fixture.sessionId]);
  let reached; const atWrite = new Promise((done) => { reached = done; }); let release; const gate = new Promise((done) => { release = done; });
  const database = new PostgresDatabase(cluster.servicePool, { beforeQuery: async (query) => {
    if (query.table === 'session_state' && query.operation === 'update') { reached(); await gate; }
  } });
  const pending = request(fixture, 'setSessionLength', { sessionLength: 'SHORT' }, 0, database);
  await Promise.race([atWrite, pending.then(async (response) => { throw new Error(`Action ended before write: ${response.status} ${await response.text()}`); })]);
  try {
    assert.equal((await cluster.database.rpc('reset_workshop_session', { p_session_id: fixture.sessionId, p_expected_version: 0 })).data, true);
    assert.equal((await cluster.database.rpc('start_workshop_session', { p_session_id: fixture.sessionId, p_expected_version: 1, p_protocol: 'draw-it-by-ear', p_init: {} })).data, true);
    // The new game deliberately has the same JSON write_revision as the old game.
    await cluster.pool.query('UPDATE session_state SET state_json=$1,phase=$2 WHERE session_id=$3', [JSON.stringify(initial), initial.phase, fixture.sessionId]);
    const before = await snapshot(fixture); release();
    assert.equal((await pending).status, 409);
    assert.deepEqual(await snapshot(fixture), before);
  } finally { release(); await pending; }
});

test('Schema readiness detects a disabled revision trigger and migrations are replayable', async () => {
  for (const migration of ['035_session_snapshot_revision.sql','036_workshop_lifecycle.sql']) {
    await cluster.pool.query(await readFile(join(appRoot, 'supabase/migrations', migration), 'utf8'));
  }
  assert.equal((await cluster.database.rpc('workshop_session_reliability_schema_ready')).data, true);
  const audit = await readFile(join(appRoot, 'supabase/verify-schema.sql'), 'utf8');
  const client = await cluster.pool.connect();
  try {
    assert.equal((await client.query(audit)).rows.filter(row => row.migration.startsWith('035') || row.migration.startsWith('036')).length, 0);
    await client.query('BEGIN');
    await client.query('ALTER TABLE session_state DISABLE TRIGGER session_snapshot_revision');
    assert.equal((await client.query('SELECT workshop_session_reliability_schema_ready() AS ready')).rows[0].ready, false);
    assert.equal((await client.query(audit)).rows.filter(row => row.kind === 'trigger').length, 1);
  } finally { await client.query('ROLLBACK'); client.release(); }
});
