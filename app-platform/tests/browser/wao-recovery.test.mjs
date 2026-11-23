import assert from 'node:assert/strict';
import {before,after,test as nodeTest} from 'node:test';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
import {startBrowserServer} from './server.mjs';
const test=(name,run)=>nodeTest(name,{timeout:20000},run);
let app,browser;
before(async()=>{app=await startBrowserServer();browser=await chromium.launch({channel:'chrome',headless:true});},{timeout:120000});
after(async()=>{await browser?.close();await app?.close();});
const read=page=>page.getByTestId('hook-state').textContent().then(JSON.parse);
const loaded=page=>page.waitForFunction(()=>{const e=document.querySelector('[data-testid="hook-state"]');return e&&JSON.parse(e.textContent).state&&typeof window.__workshopSend==='function';},null,{timeout:6000});
const idle=page=>page.waitForFunction(()=>{const e=document.querySelector('[data-testid="hook-state"]');if(!e)return false;const p=JSON.parse(e.textContent);return p.state&&!p.pending&&!p.error;},null,{timeout:6000});
async function fixture(t,prepare){const f=await app.seed('wao'),context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));t.after(async()=>{await context.close();assert.deepEqual(errors,[]);});await prepare?.(page,f);await page.goto(app.url(f)+'&hook=1');return {f,context,page};}

test('R6/R7 WAO: failed initial state recovers without a socket notification',async t=>{
 let blocked=true;const {page}=await fixture(t,async page=>page.route('**/api/wao/session/*/play',r=>blocked?r.abort():r.continue()));
 await page.waitForTimeout(200);blocked=false;await loaded(page);await idle(page);
});
test('R6/R7 WAO: peer selections arrive through reconciliation when every broadcast is missed',async t=>{
 const {page}=await fixture(t);await loaded(page);const {state}=await read(page);
 const peer=state.myParticipantId===state.participantA?state.participantB:state.participantA,itemId=state.items[0].id;
 const response=await app.cluster.database.rpc('record_wao_tap',{p_pair_id:state.pairId,p_actor_id:peer,p_item_id:itemId,p_action:'select',p_client_seq:1,p_operation_id:randomUUID()});assert.equal(response.error,null);
 await page.waitForFunction(itemId=>JSON.parse(document.querySelector('[data-testid="hook-state"]').textContent).state?.selectionTheirs.includes(itemId),itemId,{timeout:5000});
});
for(const mode of ['offline refresh','lost acknowledgement']) test(`R1/R6 WAO: ${mode} preserves one durable tap`,async t=>{
 let blocked=true,committed=false;
 const {page}=await fixture(t,async page=>page.route('**/api/wao/pair/*/tap',async route=>{if(!blocked)return route.continue();if(mode==='lost acknowledgement'&&!committed){await route.fetch();committed=true;}await route.abort();}));
 await loaded(page);const {state}=await read(page),itemId=state.items[0].id;
 await page.evaluate(itemId=>window.__workshopSend({itemId}),itemId);await page.reload();blocked=false;
 await page.evaluate(()=>window.dispatchEvent(new Event('online')));await loaded(page);await idle(page);
 assert.ok((await read(page)).state.displayMine.includes(itemId));
 const {rows}=await app.cluster.pool.query('SELECT * FROM wao_taps WHERE pair_id=$1 AND participant_id=$2',[state.pairId,state.myParticipantId]);assert.equal(rows.length,1);assert.ok(rows[0].operation_id);
});
test('R1/R2 WAO: two tabs with the same old sequence preserve independent taps',async t=>{
 const {page,context,f}=await fixture(t);await loaded(page);
 const other=await context.newPage();await other.goto(app.url(f)+'&hook=1');await loaded(other);
 const {state}=await read(page),[first,second]=state.items;
 await Promise.all([page.evaluate(itemId=>window.__workshopSend({itemId}),first.id),other.evaluate(itemId=>window.__workshopSend({itemId}),second.id)]);
 await idle(page);await idle(other);
 const {rows}=await app.cluster.pool.query('SELECT * FROM wao_taps WHERE pair_id=$1 AND participant_id=$2 ORDER BY client_seq',[state.pairId,state.myParticipantId]);
 assert.equal(rows.length,2);assert.deepEqual(rows.map(r=>r.client_seq),[1,2]);assert.equal(new Set(rows.map(r=>r.operation_id)).size,2);
 await page.waitForFunction(ids=>ids.every(id=>JSON.parse(document.querySelector('[data-testid="hook-state"]').textContent).state?.displayMine.includes(id)),[first.id,second.id],{timeout:5000});
});
test('R4/R7 WAO: a stopped timer and a lost close acknowledgement still reach scored reveal',async t=>{
 let dropped=false;const {page,f}=await fixture(t,async page=>page.route('**/api/wao/pair/*/close-timer',async route=>{if(!dropped){await route.fetch();dropped=true;await route.abort();}else await route.continue();}));
 await loaded(page);await app.cluster.pool.query("UPDATE wao_rounds SET started_at=clock_timestamp()-interval '64 seconds' WHERE id=$1",[f.roundId]);
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await page.waitForFunction(()=>{const p=JSON.parse(document.querySelector('[data-testid="hook-state"]').textContent);return p.state?.phase==='locked'&&p.state.reveal;},null,{timeout:7000});
 const {rows:[n]}=await app.cluster.pool.query('SELECT count(*)::int n FROM wao_round_results r JOIN wao_pairs p ON p.id=r.pair_id WHERE p.round_id=$1',[f.roundId]);assert.equal(n.n,2);
});
test('R6 WAO: temporary read failures retain selections and clear the reconnect warning after recovery',async t=>{
 const {page,context}=await fixture(t);await loaded(page);const before=(await read(page)).state.pairId;
 await context.setOffline(true);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-testid="hook-state"]').textContent).error,null,{timeout:5000});
 assert.equal((await read(page)).state.pairId,before);await context.setOffline(false);await page.evaluate(()=>window.dispatchEvent(new Event('online')));await idle(page);
});
