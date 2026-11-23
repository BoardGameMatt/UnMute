import assert from 'node:assert/strict';
import { test } from 'node:test';
import { importApp, useDatabase } from './runtime.mjs';
import { MemoryDatabase } from './database.mjs';

const dibe = await importApp('lib/protocols/draw-it-by-ear/engine.ts');
const { POST: dibeAction } = await importApp('app/api/session/[id]/action/route.ts');
const { POST: waoTap } = await importApp('app/api/wao/pair/[pairId]/tap/route.ts');
const { resolvePackId } = await importApp('lib/protocols/say-less/store.ts');
const { GET: waoState } = await importApp('app/api/wao/pair/[pairId]/state/route.ts');

const NOW = Date.parse('2026-10-29T16:00:00Z');
const people = ['a', 'b', 'c'].map((id) => ({ id, display_name: id }));
const catalog = [{ id: 'image', name: 'RoboDoc', criteria: [{ text: 'A circle', points: 1 }] }];
const roster = people.map((person) => ({
  id: `membership-${person.id}`, session_id: 'session', participant_id: person.id,
  role_in_session: person.id === 'a' ? 'lead' : 'member', connected: true,
  participants: { display_name: person.display_name },
}));

function setup(t, db) {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  useDatabase(db);
}

function initialDibe() { return dibe.initializeGame(people, catalog, 'a'); }

function dibeDatabase(state) {
  return new MemoryDatabase({
    sessions: [{ id: 'session', protocols: { slug: 'draw-it-by-ear' } }],
    session_participants: roster,
    session_state: [{ id: 'state', session_id: 'session', phase: state.phase, state_json: state }],
  });
}

function request(body) {
  return new Request('http://workshop.invalid/action', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

function sendDibe(actionType, payload = {}) {
  return dibeAction(request({ actionType, payload }), { params: { id: 'session' } });
}

function sendTap(itemId, clientSeq) {
  return waoTap(request({ itemId, clientSeq, action: 'select' }), { params: { pairId: 'pair' } });
}

function waoDatabase({ startedAt = NOW, lockedAt = null } = {}) {
  return new MemoryDatabase({
    session_participants: roster,
    wao_pairs: [{ id: 'pair', round_id: 'round', participant_a: 'a', participant_b: 'b' }],
    wao_rounds: [{ id: 'round', wao_session_id: 'wao', question_id: 'question',
      started_at: new Date(startedAt).toISOString(), locked_at: lockedAt }],
    wao_sessions: [{ id: 'wao', session_id: 'session', timer_seconds: 60 }],
    wao_questions: [{ id: 'question', category_title: 'Example', disambiguation_rule: 'Example rule' }],
    participants: people.map((person) => ({ id: person.id, display_name: person.display_name })),
    wao_question_items: ['first', 'second'].map((id) => ({ id, question_id: 'question' })),
    wao_taps: [],
  }, { wao_taps: [['pair_id', 'participant_id', 'client_seq']] });
}

test('R2 DIBE: simultaneous acknowledged submissions are both preserved', { timeout: 3000 }, async (t) => {
  const state = { ...initialDibe(), phase: 'ROUND_SCORING_1PT', active_criteria: catalog[0].criteria };
  const db = dibeDatabase(state);
  setup(t, db);
  const gate = db.hold('session_state', 'select', { stage: 'afterRead', count: 2 });
  const pending = ['a', 'b'].map((participantId) => sendDibe('submitScoring', {
    participantId, answers: { 'A circle': true },
  }));
  try { await gate.reached; } finally { gate.release(); }
  const responses = await Promise.all(pending);
  for (const response of responses) assert.equal(response.status, 200);
  const saved = db.rows('session_state')[0].state_json.scoring_submissions;
  assert.deepEqual(Object.keys(saved).sort(), ['a', 'b'], 'Both accepted submissions must survive');
});

test('R1 WAO: refreshed pair state resumes after the last persisted tap', async (t) => {
  const db = waoDatabase();
  setup(t, db);
  assert.equal((await sendTap('first', 1)).status, 200);
  const response = await waoState(new Request('http://workshop.invalid/state'), { params: { pairId: 'pair' } });
  assert.equal(response.status, 200);
  const state = await response.json();
  assert.equal(state.lastClientSeq, 1);
  assert.equal((await sendTap('second', state.lastClientSeq + 1)).status, 200);
  assert.deepEqual(db.rows('wao_taps').map((tap) => tap.item_id), ['first', 'second']);
});

test('R2 Say Less: fallback pack binding preserves a concurrent explicit assignment', { timeout: 3000 }, async (t) => {
  const db = new MemoryDatabase({
    sessions: [{ id: 'session', protocol_id: 'protocol', content_pack_id: null }],
    content_packs: [{ id: 'pack-a', protocol_id: 'protocol', slug: 'a', status: 'active' }],
  });
  setup(t, db);
  const gate = db.hold('content_packs', 'select', { stage: 'afterRead' });
  const pending = resolvePackId(db, 'session');
  try {
    await gate.reached;
    await db.from('sessions').update({ content_pack_id: 'pack-b' }).eq('id', 'session');
  } finally { gate.release(); }
  assert.equal(await pending, 'pack-b');
  assert.equal(db.rows('sessions')[0].content_pack_id, 'pack-b');
});

test('R4 DIBE: valid deadline expiry and deliberate lead override still advance', async (t) => {
  setup(t, new MemoryDatabase({}));
  const state = dibe.readyMaterials(dibe.setSessionLength(initialDibe(), 'SHORT'));
  let db = dibeDatabase(state);
  useDatabase(db);
  const lead = await sendDibe('leadAdvanceTimedPhase', { armedPhase: state.phase });
  assert.equal(lead.status, 200);
  assert.equal(db.rows('session_state')[0].state_json.phase, 'TUTORIAL_IMAGE_REVEAL');
  db = dibeDatabase(state);
  useDatabase(db);
  t.mock.timers.tick(90000);
  assert.equal((await sendDibe('describeTimerExpired', { armedPhase: state.phase, timerStartedAt: state.timer_started_at })).status, 200);
  assert.equal(db.rows('session_state')[0].state_json.phase, 'TUTORIAL_IMAGE_REVEAL');
});

test('R4 DIBE: an old timer instance cannot expire a new timer with the same phase', async (t) => {
  setup(t, new MemoryDatabase({}));
  const state = dibe.readyMaterials(dibe.setSessionLength(initialDibe(), 'SHORT'));
  const db = dibeDatabase(state);
  useDatabase(db);
  t.mock.timers.tick(90000);
  await sendDibe('describeTimerExpired', { armedPhase: state.phase, timerStartedAt: new Date(NOW - 1000).toISOString() });
  assert.equal(db.rows('session_state')[0].state_json.phase, 'TUTORIAL_DESCRIBE');
});

test('R2 DIBE: repeated storage conflicts are bounded and return a retryable error', async (t) => {
  const db = dibeDatabase(initialDibe());
  setup(t, db);
  // A concurrent writer wins each compare-and-swap. Do not turn this into success.
  const execute = db.execute.bind(db);
  db.execute = async (query) => query.table === 'session_state' && query.operation === 'update'
    ? { data: null, error: null } : execute(query);
  assert.equal((await sendDibe('setSessionLength', { sessionLength: 'SHORT' })).status, 409);
  assert.equal(db.rows('session_state')[0].state_json.session_length, null);
});

test('R2 DIBE: a delayed no-op cannot erase a newer choice', { timeout: 3000 }, async (t) => {
  const db = dibeDatabase(initialDibe());
  setup(t, db);
  const gate = db.hold('session_state', 'select', { stage: 'afterRead' });
  // startRound is a no-op during MATERIALS_CHECK.
  const delayed = sendDibe('startRound');
  try {
    await gate.reached;
    const newer = await sendDibe('setSessionLength', { sessionLength: 'SHORT' });
    assert.equal(newer.status, 200);
  } finally { gate.release(); }
  assert.equal((await delayed).status, 200);
  assert.equal(db.rows('session_state')[0].state_json.session_length, 'SHORT', 'A no-op must not rewind state');
});

test('R2 DIBE: a full 20-person room preserves simultaneous partial scoring', { timeout: 3000 }, async (t) => {
  const participants = Array.from({ length: 20 }, (_, index) => ({ id: `p${index}`, display_name: `Player ${index}` }));
  const state = { ...dibe.initializeGame(participants, catalog, 'p0'), phase: 'ROUND_SCORING_1PT',
    active_criteria: [{ text: 'A circle', points: 1 }, { text: 'A square', points: 1 }] };
  const db = dibeDatabase(state);
  setup(t, db);
  const gate = db.hold('session_state', 'select', { stage: 'afterRead', count: 20 });
  const pending = participants.map((person) => sendDibe('submitScoring', { participantId: person.id, answers: { 'A circle': true } }));
  try { await gate.reached; } finally { gate.release(); }
  for (const response of await Promise.all(pending)) assert.equal(response.status, 200);
  assert.equal(Object.keys(db.rows('session_state')[0].state_json.scoring_submissions).length, 20);
  assert.equal(db.rows('session_state')[0].state_json.write_revision, 20);
});

test('R4 DIBE: an early callback receives a server delay and succeeds when retried', async (t) => {
  setup(t, new MemoryDatabase({}));
  const state = dibe.readyMaterials(dibe.setSessionLength(initialDibe(), 'SHORT'));
  const db = dibeDatabase(state);
  useDatabase(db);
  const payload = { armedPhase: state.phase, timerStartedAt: state.timer_started_at };
  const early = await sendDibe('describeTimerExpired', payload);
  const body = await early.json();
  assert.equal(body.changed, false);
  assert.equal(body.retryAfterMs, 90000);
  t.mock.timers.tick(body.retryAfterMs + 50);
  assert.equal((await sendDibe('describeTimerExpired', payload)).status, 200);
  assert.equal(db.rows('session_state')[0].state_json.phase, 'TUTORIAL_IMAGE_REVEAL');
});

test('R4 WAO: deadline boundary retains the existing three-second settle window', async (t) => {
  const db = waoDatabase({ startedAt: NOW - 60000 });
  setup(t, db);
  assert.equal((await sendTap('first', 1)).status, 200);
  t.mock.timers.tick(3000);
  assert.equal((await sendTap('second', 2)).status, 409);
  assert.equal(db.rows('wao_taps').length, 1);
});

test('R4 DIBE: a freshly started 90-second timer cannot expire early', async (t) => {
  setup(t, new MemoryDatabase({}));
  const state = dibe.readyMaterials(dibe.setSessionLength(initialDibe(), 'SHORT'));
  const db = dibeDatabase(state);
  useDatabase(db);
  const response = await sendDibe('describeTimerExpired', { armedPhase: 'TUTORIAL_DESCRIBE' });
  assert.ok(response.status < 500, 'Early expiry should be rejected or safely ignored');
  assert.equal(db.rows('session_state')[0].state_json.phase, 'TUTORIAL_DESCRIBE', 'The server deadline is still 90 seconds away');
});

test('R1 WAO: replay after a lost acknowledgement records one effect', async (t) => {
  const db = waoDatabase();
  setup(t, db);
  assert.equal((await sendTap('first', 1)).status, 200); // Simulate losing this response.
  const replay = await sendTap('first', 1);
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).deduped, true);
  assert.equal(db.rows('wao_taps').length, 1);
});

test('R1 WAO: a reused sequence after refresh cannot silently acknowledge a different input', async (t) => {
  const db = waoDatabase();
  setup(t, db);
  assert.equal((await sendTap('first', 1)).status, 200);
  // Existing client reloads reset the sequence, so the next distinct input also uses 1.
  const response = await sendTap('second', 1);
  if (!response.ok) {
    assert.equal(response.status, 409, 'A conflicting operation needs an explicit recoverable rejection');
    return;
  }
  assert.ok(db.rows('wao_taps').some((tap) => tap.item_id === 'second'),
    'A success response must represent the newly requested input');
});

test('R4 WAO: elapsed deadline plus settle rejects input even when no browser closed the round', async (t) => {
  const db = waoDatabase({ startedAt: NOW - 10 * 60 * 1000 });
  setup(t, db);
  const response = await sendTap('first', 1);
  assert.equal(response.status, 409, 'An expired round is closed to new input independently of locked_at');
  assert.equal(db.rows('wao_taps').length, 0);
});

test('R4 WAO: an already locked round rejects input', async (t) => {
  const db = waoDatabase({ lockedAt: new Date(NOW).toISOString() });
  setup(t, db);
  assert.equal((await sendTap('first', 1)).status, 409);
  assert.equal(db.rows('wao_taps').length, 0);
});

