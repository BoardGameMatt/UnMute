import assert from 'node:assert/strict';
import { before, after, test as nodeTest } from 'node:test';
import { chromium } from 'playwright';
import { startBrowserServer } from './server.mjs';
import { importApp, withRequestDatabase } from '../reliability/runtime.mjs';

const test = (name, run) => nodeTest(name, { timeout: 15000 }, run);
let app; let browser;
before(async () => { app = await startBrowserServer(); browser = await chromium.launch({ channel: 'chrome', headless: true }); }, { timeout: 120000 });
after(async () => { await browser?.close(); await app?.close(); });
const state = (page) => page.getByTestId('shared-state');
const phase = async (page, expected) => page.waitForFunction((expected) => {
  const text = document.querySelector('[data-testid="shared-state"]')?.textContent;
  return text && JSON.parse(text).phase === expected;
}, expected, { timeout: 5000 });
async function fixturePage(t, prepare) {
  const fixture = await app.seed('code-switch');
  const context = await browser.newContext(); const page = await context.newPage();
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  t.after(async () => { await context.close(); assert.deepEqual(errors, []); });
  await prepare?.(page, fixture);
  await page.goto(`${app.url(fixture, 1)}&probe=1`);
  return { fixture, page, context };
}
const update = (fixture, phase) => app.cluster.pool.query('UPDATE session_state SET phase=$1 WHERE session_id=$2', [phase, fixture.sessionId]);

test('R6 shared provider: an initial read failure retries rather than installing a false waiting state', async (t) => {
  let failing = true;
  const { page } = await fixturePage(t, async (page) => {
    await page.route('**/supabase/rest/v1/session_state*', (route) => failing ? route.abort() : route.continue());
  });
  await page.waitForTimeout(200); failing = false;
  await phase(page, 'write');
  assert.equal(JSON.parse(await state(page).textContent()).isLoading, false);
});

test('R6/R7 shared provider: a missed notification converges while no timer or protocol polling is mounted', async (t) => {
  const { page, fixture } = await fixturePage(t);
  await phase(page, 'write'); await update(fixture, 'guess');
  await phase(page, 'guess');
});

test('R6 shared provider: resuming after missed updates takes a fresh snapshot', async (t) => {
  const { page, fixture } = await fixturePage(t);
  await phase(page, 'write'); await update(fixture, 'reveal');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await phase(page, 'reveal');
});

test('R6 shared provider: read errors preserve accepted state and show a reconnect status', async (t) => {
  const { page, context, fixture } = await fixturePage(t);
  await phase(page, 'write');
  await context.setOffline(true);
  await page.locator('p[role="status"]').waitFor({ state: 'visible', timeout: 5000 });
  assert.equal(JSON.parse(await state(page).textContent()).phase, 'write');
  assert.equal(JSON.parse(await state(page).textContent()).isLoading, false);
  await update(fixture, 'guess'); await context.setOffline(false);
  await phase(page, 'guess');
  await page.locator('p[role="status"]').waitFor({ state: 'hidden', timeout: 5000 });
  assert.equal(JSON.parse(await state(page).textContent()).connectionError, null);
});

test('R6 shared provider: an older authoritative snapshot cannot replace a newer revision', async (t) => {
  let captured;
  const { page, fixture } = await fixturePage(t, async (page) => {
    page.on('response', async (response) => {
      if (response.url().includes('/supabase/rest/v1/session_state') && !captured) captured = await response.json();
    });
  });
  await phase(page, 'write');
  await update(fixture, 'guess');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await phase(page, 'guess');
  assert.equal(captured.phase, 'write');
  await page.route('**/supabase/rest/v1/session_state*', (route) => route.fulfill({ json: captured }));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(2300);
  assert.equal(JSON.parse(await state(page).textContent()).phase, 'guess');
});

test('R6 shared provider: switching sessions ignores pending responses and hides the old session immediately', async (t) => {
  const next = await app.seed('code-switch'); await update(next, 'reveal');
  const { page, fixture } = await fixturePage(t);
  await phase(page, 'write');
  let release; const held = new Promise((resolve) => { release = resolve; });
  let reached; const captured = new Promise((resolve) => { reached = resolve; });
  await page.route(`**/supabase/rest/v1/session_state*${fixture.sessionId}*`, async (route) => {
    const response = await route.fetch(); reached(); await held;
    await route.fulfill({ response }).catch(() => {});
  });
  await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await captured;
  await page.evaluate((id) => window.__probeSwitchSession(id), next.sessionId);
  await phase(page, 'reveal'); release();
  await page.waitForTimeout(200);
  assert.equal(JSON.parse(await state(page).textContent()).phase, 'reveal');
});

test('R7 shared provider: terminal sessions stop fallback reads', async (t) => {
  const { page, fixture } = await fixturePage(t); await phase(page, 'write');
  let reads = 0; page.on('request', (request) => { if (request.url().includes('/supabase/rest/v1/session_state')) reads++; });
  await app.cluster.pool.query(`UPDATE sessions SET status='completed' WHERE id=$1`, [fixture.sessionId]);
  await update(fixture, 'reveal'); await phase(page, 'reveal');
  const before = reads; await page.waitForTimeout(2300);
  assert.equal(reads, before);
});

test('R7 facilitator: a failed Start request shows an error, releases the button, and can be retried', async (t) => {
  const fixture = await app.seed('say-less');
  assert.equal((await app.cluster.database.rpc('reset_workshop_session', { p_session_id: fixture.sessionId, p_expected_version: 0 })).data, true);
  const context = await browser.newContext(); const page = await context.newPage();
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  t.after(async () => { await context.close(); assert.deepEqual(errors, []); });
  let failing = true;
  await context.route('**/__test/start/*', (route) => failing ? route.abort('internetdisconnected') : route.continue());
  await page.goto(`${app.url(fixture)}&lobby=1&nav=1`);
  await page.getByRole('button', { name: 'Start session', exact: true }).click();
  await page.getByRole('alert').waitFor({ state: 'visible', timeout: 5000 });
  const button = page.getByRole('button', { name: 'Start session', exact: true });
  assert.equal(await button.isEnabled(), true);
  failing = false;
  const response = page.waitForResponse((response) => response.url().includes('/__test/start/'));
  await button.click();
  assert.equal((await (await response).json()).ok, true);
  assert.equal((await app.cluster.pool.query('SELECT status FROM sessions WHERE id=$1', [fixture.sessionId])).rows[0].status, 'active');
});

for (const status of ['lobby','completed','cancelled']) {
  test(`R6 lifecycle navigation: ${status} reaches an interrupted participant without a socket event`, async (t) => {
    const fixture = await app.seed('code-switch');
    const context = await browser.newContext(); const page = await context.newPage();
    const errors = []; page.on('pageerror', (error) => errors.push(error.message));
    t.after(async () => { await context.close(); assert.deepEqual(errors, []); });
    await page.goto(`${app.url(fixture, 1)}&probe=1&nav=1`); await phase(page, 'write');
    // Metadata can change without a new session_state revision. The shared
    // provider must still propagate it; completion navigation must not stall.
    await app.cluster.pool.query('UPDATE sessions SET status=$1 WHERE id=$2', [status, fixture.sessionId]);
    const expected = status === 'lobby' ? `/session/${fixture.sessionId}/lobby`
      : status === 'completed' ? `/session/${fixture.sessionId}/feedback` : 'refresh';
    await page.waitForFunction((expected) => window.__probeNavigation === expected, expected, { timeout: 5000 });
  });
}

test('R6 lobby: a member who misses Start catches up after reconnecting', async (t) => {
  const fixture = await app.seed('say-less');
  await app.cluster.database.rpc('reset_workshop_session', { p_session_id: fixture.sessionId, p_expected_version: 0 });
  const context = await browser.newContext(); const page = await context.newPage();
  t.after(() => context.close());
  await page.goto(`${app.url(fixture, 1)}&lobby=1&nav=1`);
  await page.getByRole('heading', { name: 'Say Less', exact: true }).waitFor();
  await context.setOffline(true);
  const { startSessionAction } = await importApp('app/(site)/session/[session_id]/lobby/actions.ts');
  await assert.rejects(withRequestDatabase(app.cluster.database, fixture.players[0], () => startSessionAction(fixture.sessionId, 1)), /NEXT_REDIRECT:/);
  await context.setOffline(false);
  await page.waitForFunction((url) => window.__probeNavigation === url, `/session/${fixture.sessionId}`, { timeout: 5000 });
});

test('R7 lobby: a hung Start request has a bounded failure path and can be retried', async (t) => {
  const fixture = await app.seed('say-less');
  await app.cluster.database.rpc('reset_workshop_session', { p_session_id: fixture.sessionId, p_expected_version: 0 });
  const context = await browser.newContext(); const page = await context.newPage();
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  let release; const held = new Promise((done) => { release = done; }); let first = true;
  t.after(async () => { release(); await context.close(); assert.deepEqual(errors, []); });
  await page.clock.install();
  await context.route('**/__test/start/*', async (route) => {
    if (first) { first = false; await held; }
    await route.continue().catch(() => {});
  });
  await page.goto(`${app.url(fixture)}&lobby=1&nav=1`);
  await page.getByRole('button', { name: 'Start session', exact: true }).click();
  await page.clock.fastForward(8100);
  await page.getByRole('alert').waitFor({ state: 'visible', timeout: 5000 });
  const button = page.getByRole('button', { name: 'Start session', exact: true });
  assert.equal(await button.isEnabled(), true);
  const response = page.waitForResponse((response) => response.url().includes('/__test/start/'));
  await button.click(); assert.equal((await (await response).json()).ok, true); release();
});
