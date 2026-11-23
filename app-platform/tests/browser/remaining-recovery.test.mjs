import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {before,after,test as nodeTest} from 'node:test';
import {chromium} from 'playwright';
import {startBrowserServer} from './server.mjs';
import {importApp} from '../reliability/runtime.mjs';
const test=(name,run)=>nodeTest(name,{timeout:20000},run);
const slugs=['talk-track','zoning-rights','ikwym','rank-and-file','the-truth-is','airtime','on-the-same-page','cover-story'];
let app,browser;
before(async()=>{app=await startBrowserServer();browser=await chromium.launch({channel:'chrome',headless:true});},{timeout:120000});
after(async()=>{await browser?.close();await app?.close();});
const loaded=page=>page.waitForFunction(()=>{const e=document.querySelector('[data-testid="hook-state"]');return e&&JSON.parse(e.textContent).state;},null,{timeout:7000});
const settled=page=>page.waitForFunction(()=>{const e=document.querySelector('[data-testid="hook-state"]');if(!e)return false;const p=JSON.parse(e.textContent);return p.state&&!p.pending&&!p.error;},null,{timeout:7000});
async function open(t,slug,prepare) {
 const f=await app.seed(slug);
 const context=await browser.newContext(),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 t.after(async()=>{await context.close();assert.deepEqual(errors,[]);});
 await prepare?.(page,f);
 await page.goto(`${app.url(f)}&hook=1`);return {f,page,context};
}
const next={
 'talk-track':["UPDATE talk_track_sessions SET paused=true WHERE session_id=$1",s=>s.paused===true],
 'zoning-rights':["UPDATE zoning_rights_sessions SET phase='SCOREBOARD' WHERE session_id=$1",s=>s.phase==='SCOREBOARD'],
 ikwym:["UPDATE ikwym_sessions SET phase='SCOREBOARD' WHERE session_id=$1",s=>s.phase==='SCOREBOARD'],
 'rank-and-file':["UPDATE rank_and_file_sessions SET phase='scoreboard' WHERE session_id=$1",s=>s.phase==='scoreboard'],
 'the-truth-is':["UPDATE truth_is_sessions SET phase='RESULTS',state_json=state_json || '{\"phase\":\"RESULTS\"}'::jsonb WHERE session_id=$1",s=>s.phase==='RESULTS'],
 airtime:["UPDATE airtime_sessions SET phase='final' WHERE session_id=$1",s=>s.phase==='final'],
 'on-the-same-page':["UPDATE otsp_sessions SET phase='scoreboard',game_json=game_json || '{\"phase\":\"scoreboard\"}'::jsonb WHERE session_id=$1",s=>s.phase==='scoreboard'],
 'cover-story':["UPDATE cover_story_sessions SET phase='reading' WHERE session_id=$1",s=>s.phase==='reading'],
};
for(const slug of slugs) {
 test(`R6/R7 ${slug}: failed first read recovers without a notification`,async t=>{
  let blocked=true;
  const {page}=await open(t,slug,async page=>{await page.route(`**/api/${slug}/session/*/play*`,route=>blocked?route.abort():route.continue());});
  await page.waitForTimeout(250);blocked=false;await loaded(page);await settled(page);
 });
 test(`R6/R7 ${slug}: offline/resume catches a private update with every socket absent`,async t=>{
  const {f,page,context}=await open(t,slug);await loaded(page);await context.setOffline(true);
  await app.cluster.pool.query(next[slug][0],[f.sessionId]);await context.setOffline(false);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  const expected=next[slug][1].toString();
  await page.waitForFunction(expected=>{const p=JSON.parse(document.querySelector('[data-testid="hook-state"]').textContent);return p.state&&new Function('s',`return (${expected})(s)`)(p.state);},expected,{timeout:7000});
  await settled(page);
 });
}

async function input(f) {
 const admin=app.cluster.database,sessionId=f.sessionId,participantId=f.players[0];
 if(f.slug==='talk-track') {
  const {rows:[turn]}=await app.cluster.pool.query('SELECT t.* FROM talk_track_turns t JOIN talk_track_sessions s ON s.current_turn_id=t.id WHERE s.session_id=$1',[sessionId]);
  return {actor:f.players.indexOf(turn.train_ids[0]),action:{type:'stop'},count:()=>app.cluster.pool.query("SELECT count(*)::int n FROM talk_track_turns t JOIN talk_track_sessions s ON s.current_turn_id=t.id WHERE s.session_id=$1 AND t.subphase='guessing'",[sessionId])};
 }
 if(f.slug==='zoning-rights') {
  const engine=await importApp('lib/protocols/zoning-rights/engine.ts');const {rows:[s]}=await app.cluster.pool.query('SELECT * FROM zoning_rights_sessions WHERE session_id=$1',[sessionId]);
  return {actor:0,action:{type:'lockLots',cells:engine.legalLots(s.board_json).slice(0,3)},count:()=>app.cluster.pool.query("SELECT count(*)::int n FROM zoning_rights_sessions WHERE session_id=$1 AND phase='IND_ZM_ASSIGN'",[sessionId])};
 }
 if(f.slug==='ikwym') {
  const m=await importApp('lib/protocols/i-know-what-you-meme/actions.ts');assert.equal((await m.dispatchIkwymAction({admin,sessionId,participantId,isLead:true,action:{type:'broadcastRound'}})).ok,true);
  return {actor:1,action:{type:'confirmGif',gifUrl:'https://media.giphy.com/media/test/giphy.gif',openResponse:'calm',stimulusResponse:'soup',searchQuery:'calm soup'},count:()=>app.cluster.pool.query('SELECT count(*)::int n FROM ikwym_responses WHERE session_id=$1 AND participant_id=$2',[sessionId,f.players[1]])};
 }
 if(f.slug==='rank-and-file') {
  const {rows:[deal]}=await app.cluster.pool.query('SELECT d.* FROM rank_and_file_deals d JOIN rank_and_file_rounds r ON r.id=d.round_id WHERE r.session_id=$1 AND d.participant_id<>$2 LIMIT 1',[sessionId,f.players[0]]);
  return {actor:f.players.indexOf(deal.participant_id),action:{type:'lockClue',text:'Toast with jam'},count:()=>app.cluster.pool.query('SELECT count(*)::int n FROM rank_and_file_deals WHERE id=$1 AND locked_at IS NOT NULL',[deal.id])};
 }
 if(f.slug==='the-truth-is') return {actor:1,action:{type:'submitEntry',round:1,text:'I kept this input through a refresh.'},count:()=>app.cluster.pool.query('SELECT count(*)::int n FROM truth_is_entries WHERE session_id=$1 AND author_id=$2',[sessionId,f.players[1]])};
 if(f.slug==='airtime') {
  const m=await importApp('lib/protocols/airtime/actions.ts');assert.equal((await m.dispatchAirtimeAction({admin,sessionId,participantId,canControl:true,isDisplay:false,action:{type:'startDive'}})).ok,true);
  return {actor:1,action:{type:'choose',choice:'up',turn:1},count:()=>app.cluster.pool.query('SELECT count(*)::int n FROM airtime_choices WHERE session_id=$1 AND participant_id=$2',[sessionId,f.players[1]])};
 }
 if(f.slug==='on-the-same-page') {
  const {rows:[s]}=await app.cluster.pool.query('SELECT game_json FROM otsp_sessions WHERE session_id=$1',[sessionId]);
  assert.equal(s.game_json.phase,'build');assert.equal(s.game_json.round.cursor,0);
  return {actor:f.players.indexOf(s.game_json.round.placers[0]),action:{type:'place',tile:'square',row:0,col:0},count:()=>app.cluster.pool.query("SELECT jsonb_array_length(game_json#>'{round,placements}')::int n FROM otsp_sessions WHERE session_id=$1",[sessionId])};
 }
 if(f.slug==='cover-story') {
  const data=JSON.parse(await readFile(new URL('../../supabase/seed-data/cover-story-agencies-v1.json',import.meta.url),'utf8'));
  for(const a of data.agencies.filter(a=>a.playable)) {
   await app.cluster.pool.query('INSERT INTO cover_story_agencies(id,slug,official_name,aliases,kind,pop_culture,tier,playable,active,hr_safe) VALUES($1,$2,$3,$4,$5,$6,$7,true,true,true) ON CONFLICT(id) DO NOTHING',[a.id,a.slug,a.official_name,a.aliases,a.kind,a.pop_culture,a.tier]);
   for(const w of a.words) await app.cluster.pool.query('INSERT INTO cover_story_agency_words(agency_id,ordinal,phrase,difficulty) VALUES($1,$2,$3,$4) ON CONFLICT(agency_id,ordinal) DO NOTHING',[a.id,w.ordinal,w.phrase,w.difficulty]);
  }
  const m=await importApp('lib/cover-story/actions.ts');
  for(const type of ['startReading','gateDiscussion','openInsights','openDeal']) assert.equal((await m.dispatchCoverStoryAction({admin,sessionId,participantId,isLead:true,action:{type}})).ok,true);
  const {rows:[deal]}=await app.cluster.pool.query('SELECT d.* FROM cover_story_deals d JOIN cover_story_sessions s ON s.id=d.cover_story_session_id WHERE s.session_id=$1 AND d.participant_id=$2',[sessionId,participantId]);
  return {actor:0,action:{type:'lockAgency',agencyId:deal.shown_agency_ids[0]},count:()=>app.cluster.pool.query('SELECT count(*)::int n FROM cover_story_deals WHERE id=$1 AND locked_agency_id IS NOT NULL',[deal.id])};
 }
 return null;
}
for(const slug of slugs) for(const loss of ['offline refresh','lost acknowledgement']) test(`R1/R6 ${slug}: ${loss} replays one input once`,async t=>{
 const f=await app.seed(slug),entry=await input(f),context=await browser.newContext(),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));t.after(async()=>{await context.close();assert.deepEqual(errors,[]);});
 let blocked=true,committed=false;
 await page.route(`**/api/${slug}/session/*/action*`,async route=>{
  if(!blocked)return route.continue();
  if(loss==='lost acknowledgement'&&!committed) {await route.fetch();committed=true;}
  await route.abort();
 });
 await page.goto(`${app.url(f,entry.actor)}&hook=1`);await loaded(page);
 await page.evaluate(action=>window.__workshopSend(action),entry.action);
 await page.reload();blocked=false;await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 try { await settled(page); } catch(error) { throw new Error(`${error.message}; ${await page.getByTestId('hook-state').textContent()}`); }
 assert.equal((await entry.count()).rows[0].n,1);
 const writes=app.requests.filter(r=>r.path.includes(f.sessionId)&&r.path.endsWith('/action'));
 if(loss==='lost acknowledgement') {assert.ok(writes.length>=2);assert.equal(writes[0].body.operationId,writes.at(-1).body.operationId);}
});

for(const slug of ['the-truth-is','rank-and-file','ikwym']) test(`R6 ${slug}: the actual entry screen retains unsubmitted text across refresh`,async t=>{
 const f=await app.seed(slug),entry=await input(f);
 const context=await browser.newContext(),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));t.after(async()=>{await context.close();assert.deepEqual(errors,[]);});
 await page.goto(`${app.url(f,entry.actor)}&screen=1`);
 const inputs=page.getByRole('textbox');await inputs.first().waitFor({state:'visible',timeout:5000});
 await inputs.first().fill('A draft worth keeping');
 if(slug==='ikwym') await inputs.nth(1).fill('Soup with noodles');
 await page.reload();await inputs.first().waitFor({state:'visible',timeout:5000});
 await page.waitForFunction(()=>document.querySelector('textarea,input:not([type]),input[type="text"]')?.value==='A draft worth keeping',null,{timeout:5000});
 if(slug==='ikwym') assert.equal(await inputs.nth(1).inputValue(),'Soup with noodles');
});
