import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {importApp,withRequestDatabase} from './runtime.mjs';
import {startPostgres,PostgresDatabase} from './postgres.mjs';
import {seedWorkshop} from './transaction-fixtures.mjs';
let cluster;
const lobby=await importApp('app/(site)/session/[session_id]/lobby/actions.ts');
const truth=await importApp('lib/protocols/the-truth-is/actions.ts');
const infra=await importApp('lib/session/workshop-transaction.ts');
before(async()=>{cluster=await startPostgres();});after(async()=>{await cluster?.close();});
async function started(slug,count=4){const f=await seedWorkshop(cluster.pool,slug,{headcount:count,status:'lobby'});await assert.rejects(withRequestDatabase(cluster.database,f.players[0],()=>lobby.startSessionAction(f.sessionId,0)),/NEXT_REDIRECT:/);return f;}
const snapshot=async f=>(await cluster.database.rpc('load_workshop_transaction',{p_session_id:f.sessionId})).data;

test('R1/R2 The Truth Is: twenty simultaneous acknowledged submissions survive; replay and conflicting ID reuse are explicit',async()=>{
 const f=await started('the-truth-is',20);
 const context=await infra.withWorkshopTransaction(cluster.database,f.sessionId,'view',async client=>infra.workshopActionContext(client));
 let count=0,release;const gate=new Promise(resolve=>{release=resolve;});
 const database=new PostgresDatabase(cluster.servicePool,{afterRpc:async name=>{if(name!=='load_workshop_transaction')return;if(++count===20)release();await gate;}});
 const actions=f.players.map((actor,index)=>({type:'submitEntry',text:`Independent entry ${index}`,round:1,operationId:randomUUID(),workshopContext:context}));
 const execute=(index,action,db=cluster.database)=>truth.dispatchTruthIsAction({admin:db,sessionId:f.sessionId,participantId:f.players[index],isLead:index===0,action});
 const results=await Promise.all(actions.map((action,index)=>execute(index,action,database)));
 assert.ok(results.every(result=>result.ok),JSON.stringify(results));
 assert.equal((await cluster.pool.query('SELECT count(*)::int n FROM truth_is_entries WHERE session_id=$1',[f.sessionId])).rows[0].n,20);
 assert.equal((await execute(0,actions[0])).ok,true);
 const conflict=await execute(0,{...actions[0],text:'Different intent, reused ID'});assert.equal(conflict.status,409);
 assert.equal((await execute(1,actions[0])).status,409);
});

for(const [slug,min] of [['talk-track',4],['zoning-rights',3],['i-know-what-you-meme',3],['rank-and-file',3],['the-truth-is',3],['airtime',2],['on-the-same-page',8]]) test(`R4/R5 ${slug}: a previous generation's delayed timer cannot touch a restarted workshop`,async()=>{
 const f=await started(slug,min);
 const context=await infra.withWorkshopTransaction(cluster.database,f.sessionId,'view',async client=>infra.workshopActionContext(client));
 assert.deepEqual(await withRequestDatabase(cluster.database,f.players[0],()=>lobby.returnToLobbyAction(f.sessionId,1)),{ok:true});
 await assert.rejects(withRequestDatabase(cluster.database,f.players[0],()=>lobby.startSessionAction(f.sessionId,2)),/NEXT_REDIRECT:/);
 const before=await snapshot(f),module=await importApp(`lib/protocols/${slug}/actions.ts`);
 const dispatch=Object.entries(module).find(([key])=>/^dispatch.*Action$/.test(key))[1];
 const result=await dispatch({admin:cluster.database,sessionId:f.sessionId,participantId:f.players[0],isLead:true,isDisplay:false,canControl:true,
  action:{type:slug==='on-the-same-page'?'expire':'timerExpired',actorId:f.players[0],operationId:randomUUID(),workshopContext:context}});
 assert.equal(result.status,409,JSON.stringify(result));assert.deepEqual(await snapshot(f),before);
});

test('R4 The Truth Is: a submission that waits on a real database lock cannot commit after the server deadline',async()=>{
 const f=await started('the-truth-is',3),deadline=Date.now()+700;
 await cluster.pool.query("UPDATE truth_is_sessions SET state_json=jsonb_set(state_json,'{timer_started_at}',to_jsonb($2::text)) WHERE session_id=$1",[f.sessionId,new Date(deadline-75000).toISOString()]);
 const before=await snapshot(f),locker=await cluster.pool.connect();let signal;
 const proposed=new Promise(resolve=>{signal=resolve;});
 const database=new PostgresDatabase(cluster.servicePool,{beforeRpc:(name,args)=>{if(name==='commit_workshop_transaction'){assert.equal(Date.parse(args.p_input_deadline),deadline);assert.ok(Date.now()<deadline);signal();}}});
 await locker.query('BEGIN');await locker.query('SELECT id FROM sessions WHERE id=$1 FOR UPDATE',[f.sessionId]);
 try {
  const result=truth.dispatchTruthIsAction({admin:database,sessionId:f.sessionId,participantId:f.players[1],isLead:false,action:{type:'submitEntry',text:'Too late at commit',round:1,operationId:randomUUID()}});
  await Promise.race([proposed,new Promise((_,reject)=>setTimeout(()=>reject(new Error('No valid proposal before deadline')),2000))]);
  await new Promise(resolve=>setTimeout(resolve,Math.max(0,deadline-Date.now()+20)));
  await locker.query('COMMIT');assert.equal((await result).status,409);assert.deepEqual(await snapshot(f),before);
 } finally {await locker.query('ROLLBACK');locker.release();}
});

test('R1 Airtime: changing an already locked choice receives a conflict instead of a false acknowledgement',async()=>{
 const f=await started('airtime',2),module=await importApp('lib/protocols/airtime/actions.ts');
 const execute=action=>module.dispatchAirtimeAction({admin:cluster.database,sessionId:f.sessionId,participantId:f.players[0],canControl:true,isDisplay:false,action});
 assert.equal((await execute({type:'startDive'})).ok,true);assert.equal((await execute({type:'choose',choice:'deeper',turn:1})).ok,true);
 const before=await snapshot(f);assert.equal((await execute({type:'choose',choice:'up',turn:1})).status,409);assert.deepEqual(await snapshot(f),before);
});

test('R4 WAO: queued input rechecks its deadline under the same real locks as closure',async()=>{
 const f=await started('wrong-answers-only',2);
 const {rows:[q]}=await cluster.pool.query("INSERT INTO wao_questions(category_title,disambiguation_rule,correct_count,difficulty,region_tag,pinned) VALUES('Clock fixture','Fixture',1,1,'global',true) RETURNING id");
 const {rows:[item]}=await cluster.pool.query("INSERT INTO wao_question_items(question_id,label,is_correct,trap_tier) VALUES($1,'Choice',false,'gimme') RETURNING id",[q.id]);
 const {rows:[ws]}=await cluster.pool.query('INSERT INTO wao_sessions(session_id) VALUES($1) RETURNING id',[f.sessionId]);
 const deadline=Date.now()+700;
 const {rows:[round]}=await cluster.pool.query('INSERT INTO wao_rounds(wao_session_id,round_number,question_id,started_at) VALUES($1,1,$2,$3) RETURNING id',[ws.id,q.id,new Date(deadline-63000)]);
 const {rows:[pair]}=await cluster.pool.query('INSERT INTO wao_pairs(round_id,participant_a,participant_b,is_solo) VALUES($1,$2,$3,false) RETURNING id',[round.id,...f.players]);
 let signal;const proposed=new Promise(resolve=>{signal=resolve;});
 const database=new PostgresDatabase(cluster.servicePool,{beforeRpc:name=>{if(name==='record_wao_tap'){assert.ok(Date.now()<deadline);signal();}}});
 const locker=await cluster.pool.connect();await locker.query('BEGIN');await locker.query('SELECT id FROM sessions WHERE id=$1 FOR UPDATE',[f.sessionId]);
 try {
  const {POST}=await importApp('app/api/wao/pair/[pairId]/tap/route.ts');
  const response=withRequestDatabase(database,f.players[0],()=>POST(new Request('http://local.invalid/tap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({itemId:item.id,action:'select',clientSeq:1,operationId:randomUUID()})}),{params:{pairId:pair.id}}));
  await Promise.race([proposed,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Tap never reached commit')),2000))]);
  await new Promise(resolve=>setTimeout(resolve,Math.max(0,deadline-Date.now()+20)));await locker.query('COMMIT');
  assert.equal((await response).status,409);assert.equal((await cluster.pool.query('SELECT count(*)::int n FROM wao_taps WHERE pair_id=$1',[pair.id])).rows[0].n,0);
 } finally {await locker.query('ROLLBACK');locker.release();}
});


test('R5 schema: new migrations replay and readiness detects a disabled admission guard',async()=>{
 for(const file of ['037_remaining_workshop_transactions.sql','038_json_and_pair_workshop_guards.sql']) await cluster.pool.query(await readFile(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
 const ready=async()=>(await cluster.database.rpc('workshop_remaining_reliability_schema_ready',{}));
 assert.equal((await ready()).error,null);assert.equal((await ready()).data,true);
 await cluster.pool.query('ALTER TABLE wao_taps DISABLE TRIGGER wao_tap_admission');
 try {assert.equal((await ready()).data,false);} finally {await cluster.pool.query('ALTER TABLE wao_taps ENABLE TRIGGER wao_tap_admission');}
 assert.equal((await ready()).data,true);
});


test('R4 Draw It By Ear: lock-waiting scoring cannot commit after its actual database deadline',async()=>{
 await cluster.pool.query("INSERT INTO protocols(slug,name,type,min_players,max_players) VALUES('draw-it-by-ear','Draw It By Ear','realtime',5,20) ON CONFLICT(slug) DO NOTHING");
 const f=await started('draw-it-by-ear',5),{POST}=await importApp('app/api/session/[id]/action/route.ts');
 const request=body=>new Request('http://local.invalid/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const response=await withRequestDatabase(cluster.database,f.players[0],()=>POST(request({actionType:'initializeGame',generation:1,payload:{participants:f.players.map(id=>({id,display_name:'Player'})),imageCatalog:[{id:randomUUID(),name:'RoboDoc',criteria:[{text:'Criterion',points:1}]}],leadParticipantId:f.players[0]}}),{params:{id:f.sessionId}}));assert.equal(response.status,200);
 const deadline=Date.now()+700,timer=new Date(deadline-60000).toISOString();
 await cluster.pool.query("UPDATE session_state SET phase='ROUND_SCORING_1PT',state_json=state_json||$2::jsonb WHERE session_id=$1",[f.sessionId,JSON.stringify({phase:'ROUND_SCORING_1PT',timer_started_at:timer,timer_duration_seconds:60,active_criteria:[{text:'Criterion',points:1}]})]);
 const before=(await cluster.pool.query('SELECT * FROM session_state WHERE session_id=$1',[f.sessionId])).rows[0];
 let signal;const proposed=new Promise(resolve=>{signal=resolve;});
 const database=new PostgresDatabase(cluster.servicePool,{beforeRpc:name=>{if(name==='commit_dibe_snapshot'){assert.ok(Date.now()<deadline);signal();}}});
 const locker=await cluster.pool.connect();await locker.query('BEGIN');await locker.query('SELECT id FROM sessions WHERE id=$1 FOR UPDATE',[f.sessionId]);
 try {
  const result=withRequestDatabase(database,f.players[0],()=>POST(request({actionType:'submitScoring',generation:1,operationId:randomUUID(),payload:{participantId:f.players[0],answers:{Criterion:true},armedPhase:'ROUND_SCORING_1PT',timerStartedAt:timer}}),{params:{id:f.sessionId}}));
  await Promise.race([proposed,new Promise((_,reject)=>setTimeout(()=>reject(new Error('No scoring proposal before deadline')),2000))]);
  await new Promise(resolve=>setTimeout(resolve,Math.max(0,deadline-Date.now()+20)));await locker.query('COMMIT');
  assert.equal((await result).status,409);assert.deepEqual((await cluster.pool.query('SELECT * FROM session_state WHERE session_id=$1',[f.sessionId])).rows[0],before);
  assert.equal((await cluster.pool.query('SELECT count(*)::int n FROM workshop_action_receipts WHERE session_id=$1',[f.sessionId])).rows[0].n,0);
 } finally {await locker.query('ROLLBACK');locker.release();}
});
