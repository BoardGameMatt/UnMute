import assert from 'node:assert/strict';
import {before,after,test as nodeTest} from 'node:test';
import {chromium} from 'playwright';
import {startBrowserServer} from './server.mjs';
const test=(name,run)=>nodeTest(name,{timeout:20000},run);
let app,browser;
before(async()=>{app=await startBrowserServer();browser=await chromium.launch({channel:'chrome',headless:true});},{timeout:120000});
after(async()=>{await browser?.close();await app?.close();});
async function fixture(t,prepare,mode='screen') {
 const f=await app.seed('draw-it-by-ear'),context=await browser.newContext(),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));t.after(async()=>{await context.close();assert.deepEqual(errors,[]);});
 await prepare?.(page,f);await page.goto(app.url(f)+`&${mode}=1`);return {f,page};
}
const choose=async page=>{for(const b of await page.getByRole('button',{name:'Yes',exact:true}).all())await b.click();};
test('R1 Draw It By Ear: scoring choices survive a refresh in the actual form',async t=>{
 const {page}=await fixture(t);await page.getByRole('button',{name:'Yes',exact:true}).first().waitFor();await choose(page);
 await page.reload();await page.getByRole('button',{name:'Submit',exact:true}).waitFor();
 await assert.doesNotReject(()=>page.getByRole('button',{name:'Submit',exact:true}).click({timeout:3000}));
 await page.getByRole('button',{name:'Submitted',exact:true}).waitFor();
});
for(const mode of ['offline refresh','lost acknowledgement'])test(`R1/R6 Draw It By Ear: ${mode} preserves one accepted scoring submission`,async t=>{
 let blocked=true,committed=false;
 const {page,f}=await fixture(t,async page=>page.route('**/api/session/*/action',async route=>{
  if(route.request().postDataJSON().actionType!=='submitScoring'||!blocked)return route.continue();
  if(mode==='lost acknowledgement'&&!committed){const response=await route.fetch();assert.equal(response.status(),200);committed=true;}
  await route.abort();
 }));
 await page.getByRole('button',{name:'Yes',exact:true}).first().waitFor();await choose(page);await page.getByRole('button',{name:'Submit',exact:true}).click();
 await page.waitForFunction(()=>Object.keys(localStorage).some(key=>key.endsWith(':pending')&&localStorage.getItem(key)));
 await page.reload();blocked=false;await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await page.getByRole('button',{name:'Submitted',exact:true}).waitFor({timeout:7000});
 const {rows:[row]}=await app.cluster.pool.query('SELECT state_json FROM session_state WHERE session_id=$1',[f.sessionId]);
 assert.equal(Object.keys(row.state_json.scoring_submissions[f.players[0]]).length,3);
 assert.equal((await app.cluster.pool.query('SELECT count(*)::int n FROM workshop_action_receipts WHERE session_id=$1',[f.sessionId])).rows[0].n,1);
});
test('R4/R7 Draw It By Ear: a resumed client advances a missed expired scoring timer without mounting its timer widget',async t=>{
 const {page,f}=await fixture(t,async(_page,f)=>app.cluster.pool.query("UPDATE session_state SET state_json=state_json||$2::jsonb WHERE session_id=$1",[f.sessionId,JSON.stringify({timer_started_at:new Date(Date.now()-120000).toISOString(),timer_duration_seconds:60})]),'hook');
 await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-testid="hook-state"]')?.textContent??'{}').state?.phase==='ROUND_SCORING_2PT',null,{timeout:7000});
 assert.equal((await app.cluster.pool.query('SELECT state_json FROM session_state WHERE session_id=$1',[f.sessionId])).rows[0].state_json.phase,'ROUND_SCORING_2PT');
});
