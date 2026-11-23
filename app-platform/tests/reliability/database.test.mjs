import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MemoryDatabase } from './database.mjs';

test('harness: injected failed writes leave rows unchanged and consume one fault', async () => {
  const db = new MemoryDatabase({ state: [{ id: 'one', value: 0 }] });
  db.failNext('state', 'update');
  assert.equal((await db.from('state').update({ value: 1 }).eq('id', 'one')).error.code, 'TEST_FAILURE');
  assert.equal(db.rows('state')[0].value, 0);
  assert.equal((await db.from('state').update({ value: 2 }).eq('id', 'one')).error, null);
  assert.equal(db.rows('state')[0].value, 2);
});

test('harness: explicit uniqueness rejects a conflicting insert without mutation', async () => {
  const db = new MemoryDatabase({ taps: [] }, { taps: [['actor', 'sequence']] });
  await db.from('taps').insert({ actor: 'a', sequence: 1, item: 'one' });
  assert.equal((await db.from('taps').insert({ actor: 'a', sequence: 1, item: 'two' })).error.code, '23505');
  assert.equal(db.rows('taps').length, 1);
});

test('harness: barriers capture stale read snapshots rather than sharing mutable rows', { timeout: 3000 }, async () => {
  const db = new MemoryDatabase({ state: [{ id: 'one', value: 0 }] });
  const gate = db.hold('state', 'select', { stage: 'afterRead', count: 2 });
  const pending = [db.from('state').select().then((value) => value), db.from('state').select().then((value) => value)];
  try {
    await gate.reached;
    await db.from('state').update({ value: 1 }).eq('id', 'one');
  } finally { gate.release(); }
  for (const snapshot of await Promise.all(pending)) assert.equal(snapshot.data[0].value, 0);
  assert.equal(db.rows('state')[0].value, 1);
});

test('harness: unsupported tables fail instead of producing a false green result', () => {
  assert.throws(() => new MemoryDatabase({}).from('missing'), /Unmodelled table/);
});
