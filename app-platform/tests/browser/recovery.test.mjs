import assert from 'node:assert/strict';
import { after, before, test as nodeTest } from 'node:test';
import { chromium } from 'playwright';
import { startBrowserServer } from './server.mjs';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { importApp } from '../reliability/runtime.mjs';

const { expireIfNeeded } = await importApp('lib/protocols/code-switch/actions.ts');

const test = (name, run) => nodeTest(name, { timeout: 20000 }, run);
let app;
let browser;
before(async () => {
  app = await startBrowserServer();
  const channel = process.env.UNMUTE_BROWSER_CHANNEL ?? 'chrome';
  browser = await chromium.launch({ ...(channel === 'chromium' ? {} : { channel }), headless: true });
  console.log(`Browser recovery: ${browser.version()}, native PostgreSQL 17.9, loopback only`);
}, { timeout: 120000 });
after(async () => { await browser?.close(); await app?.close(); });

async function player(t, fixture, index = 0, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  t.after(async () => { await context.close(); assert.deepEqual(errors, [], 'No uncaught browser exceptions'); });
  await page.goto(app.url(fixture, index));
  return { page, context };
}
const input = (page) => page.getByPlaceholder('One word');
async function visible(locator, timeout = 5000) { await locator.waitFor({ state: 'visible', timeout }); }
const locked = (page) => page.getByText('Locked in.', { exact: true });
const actionPath = (fixture) => `**/api/${fixture.slug}/session/${fixture.sessionId}/action*`;
const playPath = (fixture) => `**/api/${fixture.slug}/session/${fixture.sessionId}/play*`;
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
const eventCount = async (fixture) => Number((await app.cluster.pool.query('SELECT count(*) FROM say_less_card_events WHERE turn_id=$1', [fixture.turnId])).rows[0].count);
async function settled(page) {
  await page.waitForFunction(() => !Object.keys(localStorage).some((key) => key.startsWith('unmute:pending:')), null, { timeout: 5000 });
}
async function assertOneClue(fixture, text) {
  const { rows } = await app.cluster.pool.query('SELECT raw_text FROM code_switch_clues WHERE round_id=$1 AND participant_id=$2', [fixture.roundId, fixture.players[1]]);
  assert.deepEqual(rows, [{ raw_text: text }]);
}
async function openGuess(fixture) {
  await app.cluster.pool.query(`UPDATE code_switch_rounds SET write_started_at=clock_timestamp()-interval '61 seconds' WHERE id=$1`, [fixture.roundId]);
  await expireIfNeeded(app.cluster.database, fixture.sessionId);
}

test('SwitchCode retains an unsubmitted clue across refresh', async (t) => {
  const fixture = await app.seed('code-switch');
  const { page } = await player(t, fixture, 1);
  await input(page).fill('orchard');
  await page.reload();
  await visible(input(page));
  assert.equal(await input(page).inputValue(), 'orchard');
});

test('SwitchCode reconnects after an initial failed read without a notification', async (t) => {
  const fixture = await app.seed('code-switch');
  const context = await browser.newContext();
  const page = await context.newPage();
  t.after(() => context.close());
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let failing = true;
  await page.route('**/api/code-switch/**/play*', (route) => failing ? route.abort('internetdisconnected') : route.continue());
  await page.goto(app.url(fixture, 1));
  await page.waitForTimeout(300);
  failing = false;
  await visible(input(page));
  assert.deepEqual(errors, []);
});

test('Say Less catches up in a manual hold when every socket notification is missed', async (t) => {
  const fixture = await app.seed('say-less');
  await app.cluster.pool.query(`UPDATE say_less_sessions SET phase='hold',paused=true,current_turn_id=NULL,phase_deadline=NULL WHERE session_id=$1`, [fixture.sessionId]);
  const { page } = await player(t, fixture, 1);
  await visible(page.getByText('Paused.', { exact: true }));
  await app.cluster.pool.query(`UPDATE say_less_sessions SET phase='round_break',version=version+1 WHERE session_id=$1`, [fixture.sessionId]);
  await visible(page.getByRole('heading', { name: 'Same cards. One word only.' }));
});

test('SwitchCode preserves accepted clues and participant identity across refresh', async (t) => {
  const fixture = await app.seed('code-switch');
  const { page, context } = await player(t, fixture, 1);
  await input(page).fill('orchard');
  await page.getByRole('button', { name: 'Lock in', exact: true }).click();
  await visible(locked(page));
  await page.reload();
  await visible(locked(page));
  await assertOneClue(fixture, 'orchard');
  assert.equal((await context.cookies()).find((cookie) => cookie.name === 'unmute_participant_id').value, fixture.players[1]);
});

test('SwitchCode queues a clue while offline and submits it once after reconnect', async (t) => {
  const fixture = await app.seed('code-switch');
  const { page, context } = await player(t, fixture, 1);
  await input(page).fill('orchard');
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Lock in', exact: true }).click();
  await visible(page.getByRole('alert'));
  const reconnect = performance.now();
  await context.setOffline(false);
  await visible(locked(page));
  assert.ok(performance.now() - reconnect < 5000, 'Recovery within five seconds');
  await settled(page);
  await assertOneClue(fixture, 'orchard');
});

test('SwitchCode refresh recovers a submission that never reached the server', async (t) => {
  const fixture = await app.seed('code-switch');
  const { page, context } = await player(t, fixture, 1);
  let blocked = true;
  await context.route(actionPath(fixture), (route) => blocked ? route.abort('internetdisconnected') : route.continue());
  await input(page).fill('orchard');
  await page.getByRole('button', { name: 'Lock in', exact: true }).click();
  await visible(page.getByRole('alert'));
  blocked = false;
  await page.reload();
  await visible(locked(page));
  await settled(page);
  await assertOneClue(fixture, 'orchard');
});

test('SwitchCode lost acknowledgement followed by refresh does not duplicate or change a clue', async (t) => {
  const fixture = await app.seed('code-switch');
  const { page, context } = await player(t, fixture, 1);
  const committed = deferred();
  let first = true;
  await context.route(actionPath(fixture), async (route) => {
    const response = await route.fetch();
    if (first) { first = false; assert.equal(response.status(), 200); await route.abort('connectionreset'); committed.resolve(); }
    else await route.fulfill({ response });
  });
  await input(page).fill('orchard');
  await page.getByRole('button', { name: 'Lock in', exact: true }).click();
  await committed.promise;
  await page.reload();
  await visible(locked(page));
  await settled(page);
  await assertOneClue(fixture, 'orchard');
});

test('SwitchCode guess draft survives refresh and a lost acknowledgement scores once', async (t) => {
  const fixture = await app.seed('code-switch', { clues: ['red', 'tree', 'orchard'] });
  await openGuess(fixture);
  const { page, context } = await player(t, fixture);
  await page.getByPlaceholder('Your guess').fill(' APPLE ');
  await page.reload();
  await visible(page.getByPlaceholder('Your guess'));
  assert.equal(await page.getByPlaceholder('Your guess').inputValue(), ' APPLE ');
  let first = true;
  await context.route(actionPath(fixture), async (route) => {
    const response = await route.fetch();
    if (first) { first = false; await route.abort('connectionreset'); } else await route.fulfill({ response });
  });
  await page.getByRole('button', { name: 'Lock in', exact: true }).click();
  await visible(page.getByText('Got it', { exact: true }));
  await settled(page);
  const { rows: [row] } = await app.cluster.pool.query('SELECT team_score FROM code_switch_sessions WHERE session_id=$1', [fixture.sessionId]);
  assert.equal(row.team_score, 1);
});

test('SwitchCode rejects a recovered clue from an older round without contaminating the new one', async (t) => {
  const fixture = await app.seed('code-switch');
  const { page, context } = await player(t, fixture, 1);
  let blocked = true;
  await context.route(actionPath(fixture), (route) => blocked ? route.abort() : route.continue());
  await input(page).fill('orchard');
  await page.getByRole('button', { name: 'Lock in', exact: true }).click();
  await visible(page.getByRole('alert'));
  const nextRound = randomUUID();
  await app.cluster.pool.query(`INSERT INTO code_switch_rounds(id,session_id,round_index,guesser_id,word_id,round_type,write_started_at)
    VALUES ($1,$2,2,$3,$4,'unique',clock_timestamp())`, [nextRound, fixture.sessionId, fixture.players[0], fixture.wordId]);
  await app.cluster.pool.query('UPDATE code_switch_sessions SET current_round_id=$1 WHERE session_id=$2', [nextRound, fixture.sessionId]);
  blocked = false;
  await visible(page.getByRole('alert').filter({ hasText: 'earlier round' }));
  await settled(page);
  await visible(input(page));
  assert.equal(await input(page).inputValue(), '');
  assert.equal((await app.cluster.pool.query('SELECT count(*) FROM code_switch_clues WHERE round_id=$1', [nextRound])).rows[0].count, '0');
  assert.equal(await page.getByRole('button', { name: 'Lock in', exact: true }).isDisabled(), true, 'New blank draft is not submitted automatically');
});

test('SwitchCode reconciles server expiry after every client was offline, with no facilitator', async (t) => {
  const fixture = await app.seed('code-switch', { clues: ['orchard'] });
  const { page, context } = await player(t, fixture, 2);
  await visible(input(page));
  await context.setOffline(true);
  await app.cluster.pool.query(`UPDATE code_switch_rounds SET write_started_at=clock_timestamp()-interval '61 seconds' WHERE id=$1`, [fixture.roundId]);
  await context.setOffline(false);
  await visible(page.getByText('Don’t help. No searching. No chat.', { exact: true }).first());
  assert.equal((await app.cluster.pool.query('SELECT phase FROM code_switch_sessions WHERE session_id=$1', [fixture.sessionId])).rows[0].phase, 'guess');
});

test('Say Less reconnects with one offline Got it tap and records one point', async (t) => {
  const fixture = await app.seed('say-less');
  const { page, context } = await player(t, fixture);
  await visible(page.getByRole('button', { name: 'Got it', exact: true }));
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  await visible(page.getByRole('alert'));
  await context.setOffline(false);
  await visible(page.getByText('1 of 20 left', { exact: true }));
  await settled(page);
  assert.equal(await eventCount(fixture), 1);
});

test('Say Less refresh mid-submission preserves the exact card action', async (t) => {
  const fixture = await app.seed('say-less');
  const { page, context } = await player(t, fixture);
  let blocked = true;
  await context.route(actionPath(fixture), (route) => blocked ? route.abort() : route.continue());
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  await visible(page.getByRole('alert'));
  blocked = false;
  await page.reload();
  await visible(page.getByText('1 of 20 left', { exact: true }));
  await settled(page);
  assert.equal(await eventCount(fixture), 1);
  const posts = app.requests.filter((request) => request.path.endsWith(`${fixture.sessionId}/action`));
  assert.equal(new Set(posts.map((request) => request.body.operationId)).size, 1);
});

test('Say Less lost acknowledgement survives refresh after the final card closes the round', async (t) => {
  const fixture = await app.seed('say-less', { lastCard: true });
  const { page, context } = await player(t, fixture);
  const committed = deferred();
  let first = true;
  await context.route(actionPath(fixture), async (route) => {
    const response = await route.fetch();
    if (first) { first = false; assert.equal(response.status(), 200); await route.abort('connectionreset'); committed.resolve(); }
    else await route.fulfill({ response });
  });
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  await committed.promise;
  await page.reload();
  await visible(page.getByRole('heading', { name: 'Same cards. One word only.' }));
  await settled(page);
  assert.equal(await eventCount(fixture), 1);
  assert.equal(await page.getByRole('alert').count(), 0);
  const { rows: [event] } = await app.cluster.pool.query('SELECT card_id,outcome,operation_id FROM say_less_card_events WHERE turn_id=$1', [fixture.turnId]);
  assert.equal(event.card_id, fixture.pile[0]); assert.equal(event.outcome, 'got_it'); assert.ok(event.operation_id);
});

test('Say Less single-card pass retry is deduplicated; a subsequent intentional pass still works', async (t) => {
  const fixture = await app.seed('say-less', { round: 2, lastCard: true });
  const { page, context } = await player(t, fixture);
  let first = true;
  await context.route(actionPath(fixture), async (route) => {
    const response = await route.fetch();
    if (first) { first = false; await route.abort('connectionreset'); } else await route.fulfill({ response });
  });
  await page.getByRole('button', { name: 'Pass / Oops', exact: true }).click();
  await settled(page);
  assert.equal(await eventCount(fixture), 1);
  assert.equal((await app.cluster.pool.query('SELECT version FROM say_less_sessions WHERE session_id=$1', [fixture.sessionId])).rows[0].version, 1);
  await page.getByRole('button', { name: 'Pass / Oops', exact: true }).click();
  await settled(page);
  assert.equal(await eventCount(fixture), 2);
  assert.equal((await app.cluster.pool.query(`SELECT count(*) FROM say_less_card_events WHERE turn_id=$1 AND outcome='got_it'`, [fixture.turnId])).rows[0].count, '0');
});

test('Say Less explicitly rejects an offline tap after its turn expired and releases controls', async (t) => {
  const fixture = await app.seed('say-less');
  const { page, context } = await player(t, fixture);
  let blocked = true;
  await context.route(actionPath(fixture), (route) => blocked ? route.abort() : route.continue());
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  await visible(page.getByRole('alert'));
  await app.cluster.pool.query(`UPDATE say_less_sessions SET phase_deadline=clock_timestamp()-interval '1 second' WHERE session_id=$1`, [fixture.sessionId]);
  blocked = false;
  await visible(page.getByRole('alert').filter({ hasText: 'turn changed' }));
  await settled(page);
  await visible(page.getByRole('heading', { name: "Time's up." }));
  assert.equal((await app.cluster.pool.query(`SELECT count(*) FROM say_less_card_events WHERE turn_id=$1 AND outcome='got_it'`, [fixture.turnId])).rows[0].count, '0');
  assert.equal(await page.getByRole('button', { name: 'Pause', exact: true }).isEnabled(), true);
});

test('Say Less participant reconciles expired turn and hold with the facilitator absent', async (t) => {
  const fixture = await app.seed('say-less');
  const { page, context } = await player(t, fixture, 1);
  await visible(page.getByText('2 of 20 left', { exact: true }));
  await context.setOffline(true);
  await app.cluster.pool.query(`UPDATE say_less_sessions SET phase_deadline=clock_timestamp()-interval '1 second' WHERE session_id=$1`, [fixture.sessionId]);
  await context.setOffline(false);
  await visible(page.getByRole('heading', { name: "Time's up." }));
  await app.cluster.pool.query(`UPDATE say_less_sessions SET phase_deadline=clock_timestamp()-interval '1 second' WHERE session_id=$1`, [fixture.sessionId]);
  await visible(page.getByText('2 of 20 left', { exact: true }));
  await page.waitForFunction(() => !document.querySelector('h1')?.textContent?.includes("Time's up."), null, { timeout: 5000 });
  const { rows: [row] } = await app.cluster.pool.query('SELECT phase,current_turn_id FROM say_less_sessions WHERE session_id=$1', [fixture.sessionId]);
  assert.equal(row.phase, 'turn'); assert.notEqual(row.current_turn_id, fixture.turnId);
});

test('An old Say Less read cannot rewind a newer action response', async (t) => {
  const fixture = await app.seed('say-less');
  const { page, context } = await player(t, fixture);
  await visible(page.getByRole('button', { name: 'Got it', exact: true }));
  const captured = deferred(); const release = deferred();
  let first = true;
  await context.route(playPath(fixture), async (route) => {
    if (!first) return route.continue();
    first = false;
    const response = await route.fetch();
    captured.resolve(); await release.promise;
    await route.fulfill({ response }).catch(() => {}); // Read was intentionally aborted by the action.
  });
  await captured.promise;
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  await visible(page.getByText('1 of 20 left', { exact: true }));
  release.resolve();
  await page.waitForTimeout(250);
  assert.equal(await page.getByText('1 of 20 left', { exact: true }).count(), 1);
});

test('Resume replaces a hung read and catches up without waiting for a socket', async (t) => {
  const fixture = await app.seed('say-less');
  await app.cluster.pool.query(`UPDATE say_less_sessions SET phase='hold',paused=true,current_turn_id=NULL,phase_deadline=NULL WHERE session_id=$1`, [fixture.sessionId]);
  const { page, context } = await player(t, fixture, 1, { width: 1440, height: 900 });
  await visible(page.getByText('Paused.', { exact: true }));
  const captured = deferred(); const release = deferred(); let first = true;
  await context.route(playPath(fixture), async (route) => {
    if (!first) return route.continue();
    first = false; const response = await route.fetch(); captured.resolve();
    await release.promise; await route.fulfill({ response }).catch(() => {});
  });
  await captured.promise;
  await app.cluster.pool.query(`UPDATE say_less_sessions SET phase='round_break',version=version+1 WHERE session_id=$1`, [fixture.sessionId]);
  const resumed = performance.now();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await visible(page.getByRole('heading', { name: 'Same cards. One word only.' }));
  assert.ok(performance.now() - resumed < 5000);
  release.resolve();
  await page.waitForTimeout(250);
  assert.equal(await page.getByText('Paused.', { exact: true }).count(), 0);
  const directory = join(process.cwd(), 'output/playwright');
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: join(directory, 'say-less-recovered-desktop.png'), fullPage: true });
});

test('Facilitator and participant converge independently without any Realtime delivery', async (t) => {
  const fixture = await app.seed('code-switch', { clues: ['red', 'tree', 'orchard'] });
  await openGuess(fixture);
  const lead = await player(t, fixture, 0, { width: 1440, height: 900 });
  const member = await player(t, fixture, 1);
  await visible(member.page.getByText('Don’t help. No searching. No chat.', { exact: true }).first());
  await lead.page.getByPlaceholder('Your guess').fill('APPLE');
  await lead.page.getByRole('button', { name: 'Lock in', exact: true }).click();
  await visible(lead.page.getByText('Got it', { exact: true }));
  const committed = performance.now();
  await visible(member.page.getByText('Got it', { exact: true }));
  assert.ok(performance.now() - committed < 5000);
  await member.page.reload();
  await visible(member.page.getByText('Guess: APPLE', { exact: true }));
  const directory = join(process.cwd(), 'output/playwright');
  await mkdir(directory, { recursive: true });
  await member.page.screenshot({ path: join(directory, 'switchcode-recovered-mobile.png'), fullPage: true });
});

test('Say Less reconnecting participant catches up to an accepted tap from another browser', async (t) => {
  const fixture = await app.seed('say-less');
  const lead = await player(t, fixture);
  const member = await player(t, fixture, 1);
  await visible(member.page.getByText('2 of 20 left', { exact: true }));
  await member.context.setOffline(true);
  await lead.page.getByRole('button', { name: 'Got it', exact: true }).click();
  await visible(lead.page.getByText('1 of 20 left', { exact: true }));
  await lead.page.close();
  const reconnect = performance.now();
  await member.context.setOffline(false);
  await visible(member.page.getByText('1 of 20 left', { exact: true }));
  assert.ok(performance.now() - reconnect < 5000);
  assert.equal(await eventCount(fixture), 1);
});

test('SwitchCode retries a rolled-back storage failure without losing the queued clue', async (t) => {
  const fixture = await app.seed('code-switch');
  const { page } = await player(t, fixture, 1);
  await input(page).fill('orchard');
  await app.cluster.pool.query(`INSERT INTO test_control.failures VALUES ('session_state:UPDATE')`);
  t.after(() => app.cluster.pool.query('TRUNCATE test_control.failures'));
  await page.getByRole('button', { name: 'Lock in', exact: true }).click();
  await visible(page.getByRole('alert'));
  assert.equal((await app.cluster.pool.query('SELECT count(*) FROM code_switch_clues WHERE round_id=$1', [fixture.roundId])).rows[0].count, '0');
  await app.cluster.pool.query('TRUNCATE test_control.failures');
  await visible(locked(page));
  await settled(page);
  await assertOneClue(fixture, 'orchard');
});

test('A hung Say Less acknowledgement times out, releases its busy guard, and retries once', async (t) => {
  const fixture = await app.seed('say-less');
  const { page, context } = await player(t, fixture);
  const captured = deferred(); const release = deferred(); let first = true;
  await context.route(actionPath(fixture), async (route) => {
    if (!first) return route.continue();
    first = false; const response = await route.fetch(); captured.resolve();
    await release.promise; await route.fulfill({ response }).catch(() => {});
  });
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  await captured.promise;
  const available = performance.now();
  await visible(page.getByText('1 of 20 left', { exact: true }));
  assert.ok(performance.now() - available < 5000, 'A hung request has a bounded recovery path');
  await settled(page);
  release.resolve();
  assert.equal(await eventCount(fixture), 1);
  assert.equal(await page.getByRole('button', { name: 'Got it', exact: true }).isEnabled(), true);
});

test('Saved SwitchCode drafts and submissions are isolated by participant identity', async (t) => {
  const fixture = await app.seed('code-switch');
  const { page, context } = await player(t, fixture, 1);
  let blocked = true;
  await context.route(actionPath(fixture), (route) => blocked ? route.abort() : route.continue());
  await input(page).fill('orchard');
  await page.getByRole('button', { name: 'Lock in', exact: true }).click();
  await visible(page.getByRole('alert'));
  await page.goto(app.url(fixture, 2));
  await visible(input(page));
  assert.equal(await input(page).inputValue(), '');
  blocked = false;
  await input(page).fill('tree');
  await page.getByRole('button', { name: 'Lock in', exact: true }).click();
  await visible(locked(page));
  await page.goto(app.url(fixture, 1));
  await visible(locked(page));
  await settled(page);
  await assertOneClue(fixture, 'orchard');
  const { rows } = await app.cluster.pool.query('SELECT raw_text FROM code_switch_clues WHERE round_id=$1 ORDER BY raw_text', [fixture.roundId]);
  assert.deepEqual(rows, [{ raw_text: 'orchard' }, { raw_text: 'tree' }]);
});

test('Acknowledging one tab cannot erase another tab\'s pending card input', async (t) => {
  const fixture = await app.seed('say-less');
  const { page, context } = await player(t, fixture);
  const second = await context.newPage();
  const errors = []; second.on('pageerror', (error) => errors.push(error.message));
  await second.goto(app.url(fixture));
  await visible(second.getByRole('button', { name: 'Got it', exact: true }));
  const committed = deferred(); const release = deferred(); let blockSecond = true;
  await context.route(actionPath(fixture), async (route) => {
    if (route.request().postDataJSON().expectedVersion === 1) {
      return blockSecond ? route.abort('internetdisconnected') : route.continue();
    }
    const response = await route.fetch(); committed.resolve(); await release.promise;
    await route.fulfill({ response }).catch(() => {});
  });
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  await committed.promise;
  await visible(second.getByText('1 of 20 left', { exact: true }));
  await second.getByRole('button', { name: 'Got it', exact: true }).click();
  await visible(second.getByRole('alert'));
  release.resolve();
  await visible(page.getByText('1 of 20 left', { exact: true }));
  await page.close();
  assert.equal(await second.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('unmute:pending:')).length), 1);
  blockSecond = false;
  await second.reload();
  await visible(second.getByRole('heading', { name: 'Same cards. One word only.' }));
  await settled(second);
  assert.equal(await eventCount(fixture), 2);
  assert.deepEqual(errors, []);
});

test('A pinned shared screen refresh requests only the display payload from its first read', async (t) => {
  const fixture = await app.seed('code-switch');
  await app.cluster.pool.query('UPDATE code_switch_rounds SET guesser_id=$1 WHERE id=$2', [fixture.players[3], fixture.roundId]);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  t.after(() => context.close());
  await context.addInitScript((sessionId) => localStorage.setItem(`unmute.code-switch.display.${sessionId}`, '1'), fixture.sessionId);
  const page = await context.newPage();
  const responses = [];
  page.on('response', async (response) => {
    if (response.url().includes(`/api/code-switch/session/${fixture.sessionId}/play`)) {
      responses.push({ url: response.url(), body: await response.json() });
    }
  });
  await page.goto(app.url(fixture));
  await visible(page.getByText('Player 3 is guessing. Don’t help.', { exact: true }).first());
  await page.reload();
  await visible(page.getByText('Player 3 is guessing. Don’t help.', { exact: true }).first());
  assert.ok(responses.length >= 2);
  for (const response of responses) {
    assert.equal(new URL(response.url).searchParams.get('display'), '1');
    assert.equal(response.body.state.isDisplay, true);
    assert.equal(response.body.state.word, null);
    assert.equal(response.body.state.roundType, null);
  }
});
