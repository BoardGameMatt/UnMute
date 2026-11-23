import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { importApp, useDatabase, withRequestDatabase } from './runtime.mjs';
import { startPostgres, PostgresDatabase } from './postgres.mjs';
import { seedWorkshop } from './transaction-fixtures.mjs';

let cluster;
const lobby = await importApp('app/(site)/session/[session_id]/lobby/actions.ts');
before(async () => { cluster = await startPostgres(); });
after(async () => { await cluster?.close(); });

export const remaining = [
  ['talk-track', 'talk_track_sessions', 4],
  ['zoning-rights', 'zoning_rights_sessions', 3],
  ['i-know-what-you-meme', 'ikwym_sessions', 3],
  ['rank-and-file', 'rank_and_file_sessions', 3],
  ['the-truth-is', 'truth_is_sessions', 3],
  ['airtime', 'airtime_sessions', 2],
  ['on-the-same-page', 'otsp_sessions', 8],
];
const start = async (fixture, version = 0, database = cluster.database) => {
  try { return await withRequestDatabase(database, fixture.players[0], () => lobby.startSessionAction(fixture.sessionId, version)); }
  catch (error) { if (error.message.startsWith('NEXT_REDIRECT:')) return { ok: true }; throw error; }
};
for (const [slug, table, headcount] of remaining) {
  test(`R3/R5 ${slug}: failed activation preserves a clean lobby and retry starts once`, async () => {
    const f = await seedWorkshop(cluster.pool, slug, { headcount, status: 'lobby' });
    useDatabase(cluster.database, f.players[0]);
    await cluster.pool.query("INSERT INTO test_control.failures VALUES ('sessions:UPDATE')");
    try {
      const result = await start(f);
      assert.ok(result?.error, JSON.stringify(result));
      assert.equal((await cluster.pool.query(`SELECT count(*)::int AS n FROM ${table} WHERE session_id=$1`, [f.sessionId])).rows[0].n, 0, 'failed Start must roll back protocol rows');
      assert.equal((await cluster.pool.query('SELECT phase FROM session_state WHERE session_id=$1', [f.sessionId])).rows[0].phase, 'write', 'failed Start must preserve the previous snapshot');
    } finally { await cluster.pool.query('DELETE FROM test_control.failures'); }
    assert.deepEqual(await start(f), { ok: true });
    const before = (await cluster.pool.query(`SELECT * FROM ${table} WHERE session_id=$1`, [f.sessionId])).rows;
    assert.ok((await start(f))?.error);
    assert.deepEqual((await cluster.pool.query(`SELECT * FROM ${table} WHERE session_id=$1`, [f.sessionId])).rows, before);
  });
  test(`R5 ${slug}: simultaneous starts have one winner; failed reset and stale controls preserve the game`, async () => {
    const f = await seedWorkshop(cluster.pool, slug, { headcount, status: 'lobby' });
    let arrived = 0, release;
    const gate = new Promise(resolve => { release = resolve; });
    const database = new PostgresDatabase(cluster.servicePool, { afterRpc: async name => {
      if (name !== 'load_workshop_transaction') return;
      if (++arrived === 2) release();
      await gate;
    } });
    const results = await Promise.all([start(f, 0, database), start(f, 0, database)]);
    assert.equal(results.filter(result => result.ok).length, 1, JSON.stringify(results));
    const before = (await cluster.database.rpc('load_workshop_transaction', { p_session_id: f.sessionId })).data;
    await cluster.pool.query("INSERT INTO test_control.failures VALUES ('session_state:UPDATE')");
    try {
      const result = await withRequestDatabase(cluster.database, f.players[0], () => lobby.returnToLobbyAction(f.sessionId, 1));
      assert.ok(result.error);
      assert.deepEqual((await cluster.database.rpc('load_workshop_transaction', { p_session_id: f.sessionId })).data, before);
    } finally { await cluster.pool.query('DELETE FROM test_control.failures'); }
    assert.deepEqual(await withRequestDatabase(cluster.database, f.players[0], () => lobby.returnToLobbyAction(f.sessionId, 1)), { ok: true });
    assert.deepEqual(await start(f, 2), { ok: true });
    assert.ok((await withRequestDatabase(cluster.database, f.players[0], () => lobby.returnToLobbyAction(f.sessionId, 1))).error);
    assert.equal((await cluster.pool.query('SELECT status FROM sessions WHERE id=$1', [f.sessionId])).rows[0].status, 'active');
  });
}
