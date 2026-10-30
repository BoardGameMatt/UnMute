import { before,after,test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { importApp,withRequestDatabase } from './runtime.mjs';
import { startPostgres,PostgresDatabase } from './postgres.mjs';
import { seedWorkshop } from './transaction-fixtures.mjs';

let cluster;
const lobby=await importApp('app/(site)/session/[session_id]/lobby/actions.ts');
const cover=await importApp('lib/cover-story/actions.ts');
const {POST:dibe}=await importApp('app/api/session/[id]/action/route.ts');
const {startWaoRound}=await importApp('lib/wao/start-round.ts');
const {POST:tap}=await importApp('app/api/wao/pair/[pairId]/tap/route.ts');
const {POST:close}=await importApp('app/api/wao/pair/[pairId]/close-timer/route.ts');
const {POST:end}=await importApp('app/api/wao/session/[sessionId]/end/route.ts');
const request=body=>new Request('http://local.invalid/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
before(async()=>{
  cluster=await startPostgres();
  await cluster.pool.query("INSERT INTO protocols(slug,name,type,min_players,max_players) VALUES('draw-it-by-ear','Draw It By Ear','realtime',5,20) ON CONFLICT(slug) DO NOTHING");
  const data=JSON.parse(await readFile(new URL('../../supabase/seed-data/cover-story-agencies-v1.json',import.meta.url),'utf8'));
  for(const a of data.agencies.filter(a=>a.playable)) {
    await cluster.pool.query('INSERT INTO cover_story_agencies(id,slug,official_name,aliases,kind,pop_culture,tier,playable,active,hr_safe) VALUES($1,$2,$3,$4,$5,$6,$7,true,true,true)',[a.id,a.slug,a.official_name,a.aliases,a.kind,a.pop_culture,a.tier]);
    for(const w of a.words) await cluster.pool.query('INSERT INTO cover_story_agency_words(agency_id,ordinal,phrase,difficulty) VALUES($1,$2,$3,$4)',[a.id,w.ordinal,w.phrase,w.difficulty]);
  }
  for(let index=0;index<5;index++) {
    const {rows:[q]}=await cluster.pool.query("INSERT INTO wao_questions(category_title,disambiguation_rule,correct_count,difficulty,region_tag,pinned) VALUES($1,'Fixture rule',5,1,'global',$2) RETURNING id",[`Local question ${index}`,index===0]);
    for(let item=0;item<10;item++) await cluster.pool.query("INSERT INTO wao_question_items(question_id,label,is_correct,trap_tier) VALUES($1,$2,$3,'gimme')",[q.id,`Item ${item}`,item>=5]);
  }
});
after(async()=>{await cluster?.close();});
const start=async f=>assert.rejects(withRequestDatabase(cluster.database,f.players[0],()=>lobby.startSessionAction(f.sessionId,0)),/NEXT_REDIRECT:/);
const status=async f=>(await cluster.pool.query('SELECT status FROM sessions WHERE id=$1',[f.sessionId])).rows[0].status;
async function cs(f,action,actor=f.players[0]) {
  const result=await cover.dispatchCoverStoryAction({admin:cluster.database,sessionId:f.sessionId,participantId:actor,isLead:actor===f.players[0],action:{operationId:randomUUID(),...action}});
  assert.equal(result.ok,true,JSON.stringify({action,result}));return result;
}
const coverRow=async f=>(await cluster.pool.query('SELECT * FROM cover_story_sessions WHERE session_id=$1',[f.sessionId])).rows[0];

for(const count of [3,8,15]) test(`R1/R3/R8 Cover Story: both sittings, disjoint hands, and independently marked scores at ${count} agents`,async()=>{
  const f=await seedWorkshop(cluster.pool,'cover-story',{headcount:count,status:'lobby'});
  await cs(f,{type:'setRevealDate',revealOn:'2020-01-20'}); await start(f);
  await cs(f,{type:'startReading'});await cs(f,{type:'gateDiscussion'});await cs(f,{type:'openInsights'});
  if(count===3) {
    const before=(await cluster.database.rpc('load_workshop_transaction',{p_session_id:f.sessionId})).data;
    await cluster.pool.query("INSERT INTO test_control.failures VALUES('cover_story_deals:INSERT')");
    try { assert.equal((await cover.dispatchCoverStoryAction({admin:cluster.database,sessionId:f.sessionId,participantId:f.players[0],isLead:true,action:{type:'openDeal'}})).ok,false); }
    finally {await cluster.pool.query('DELETE FROM test_control.failures');}
    assert.deepEqual((await cluster.database.rpc('load_workshop_transaction',{p_session_id:f.sessionId})).data,before);
  }
  await cs(f,{type:'openDeal'});
  const metadata=await coverRow(f);
  const deals=(await cluster.pool.query('SELECT * FROM cover_story_deals WHERE cover_story_session_id=$1',[metadata.id])).rows;
  assert.equal(deals.length,count);assert.equal(new Set(deals.flatMap(d=>d.shown_agency_ids)).size,count*3);
  for(const deal of deals) await cs(f,{type:'lockAgency',agencyId:deal.shown_agency_ids[0]},deal.participant_id);
  await cs(f,{type:'openField'});await cs(f,{type:'startReveal'});
  const logs=(await cluster.pool.query('SELECT l.* FROM cover_story_word_logs l JOIN cover_story_deals d ON d.id=l.deal_id WHERE d.cover_story_session_id=$1',[metadata.id])).rows;
  assert.equal(logs.length,count*5);
  for(const deal of deals) await cs(f,{type:'submitMissionReport',words:logs.filter(l=>l.deal_id===deal.id).map(l=>({wordId:l.word_id,status:'not_planted'}))},deal.participant_id);
  await cs(f,{type:'beginGuessing'});
  for(let index=0;index<count;index++) {
    const live=await coverRow(f),target=live.reveal_order[live.reveal_index];
    for(const actor of f.players.filter(id=>id!==target)) await cs(f,{type:'submitGuess',agencyText:'Fixture guess',evidenceText:'Local evidence'},actor);
    await cs(f,{type:'revealCover'});await cs(f,{type:'openScoring'});
    const guesses=(await cluster.pool.query('SELECT * FROM cover_story_guesses WHERE cover_story_session_id=$1 AND target_participant_id=$2 ORDER BY id',[metadata.id,target])).rows;
    await cs(f,{type:'setMarks',marks:guesses.map((g,i)=>({guessId:g.id,markedCorrect:i===0}))});
    const action={type:'finalizeTarget',operationId:randomUUID()};
    if(count===3&&index===0) {
      const before=(await cluster.database.rpc('load_workshop_transaction',{p_session_id:f.sessionId})).data;
      await cluster.pool.query("INSERT INTO test_control.failures VALUES('cover_story_sessions:UPDATE')");
      try { assert.equal((await cover.dispatchCoverStoryAction({admin:cluster.database,sessionId:f.sessionId,participantId:f.players[0],isLead:true,action})).ok,false); }
      finally{await cluster.pool.query('DELETE FROM test_control.failures');}
      assert.deepEqual((await cluster.database.rpc('load_workshop_transaction',{p_session_id:f.sessionId})).data,before);
    }
    await cs(f,action);await cs(f,action);
    const result=(await cluster.pool.query('SELECT * FROM cover_story_target_results WHERE cover_story_session_id=$1 AND target_participant_id=$2',[metadata.id,target])).rows[0];
    assert.equal(result.n,count-1);assert.equal(result.k,1);assert.equal(result.type1_score,count-2);assert.equal(result.mission_score,0);
    if(index<count-1) await cs(f,{type:'nextTarget'});
  }
  await cs(f,{type:'showFinal'});await cs(f,{type:'completeSession'});assert.equal(await status(f),'completed');
});

const drawingState=async f=>(await cluster.pool.query('SELECT state_json FROM session_state WHERE session_id=$1',[f.sessionId])).rows[0].state_json;
async function draw(f,actionType,payload={},actor=f.players[0]) {
  const response=await withRequestDatabase(cluster.database,actor,()=>dibe(request({actionType,payload,generation:1}),{params:{id:f.sessionId}}));
  assert.equal(response.status,200,JSON.stringify({actionType,body:await response.clone().json()}));
}
for(const count of [5,10,20]) test(`R3/R8 Draw It By Ear: tutorial and three scored rounds at ${count} players preserve team totals and explicit completion`,async()=>{
  const f=await seedWorkshop(cluster.pool,'draw-it-by-ear',{headcount:count,status:'lobby'});await start(f);
  const criteria=Array.from({length:9},(_,i)=>({text:`Criterion ${i+1}`,points:Math.floor(i/3)+1}));
  await draw(f,'initializeGame',{participants:f.players.map((id,i)=>({id,display_name:`Player ${i}`})),imageCatalog:['RoboDoc','HatMan','Working Out','Dropping In For Lunch'].map(name=>({id:randomUUID(),name,criteria})),leadParticipantId:f.players[0]});
  await draw(f,'setSessionLength',{sessionLength:'SHORT'});await draw(f,'readyMaterials');
  for(let step=0;step<70;step++) {
    const state=await drawingState(f);
    if(state.phase==='FINAL_RESULTS') break;
    if(state.phase==='TUTORIAL_RESULTS') {await draw(f,'startTeamFormation');continue;}
    if(state.phase==='TEAM_FORMATION') {
      await draw(f,'autoAssignTeams');
      if(count===5) {
        const old=await drawingState(f);
        await cluster.pool.query("INSERT INTO test_control.failures VALUES('dibe_teams:INSERT')");
        try {const response=await withRequestDatabase(cluster.database,f.players[0],()=>dibe(request({actionType:'lockTeams',payload:{},generation:1}),{params:{id:f.sessionId}}));assert.notEqual(response.status,200);}
        finally{await cluster.pool.query('DELETE FROM test_control.failures');}
        assert.deepEqual(await drawingState(f),old);
      }
      await draw(f,'lockTeams');continue;
    }
    if(state.phase==='BREAKOUT_SETUP') {await draw(f,'startRound');continue;}
    if(state.phase==='ROUND_DESCRIBE') {
      for(const team of state.teams) await draw(f,'leadStartBreakoutRound',{teamId:team.id,armedPhase:state.phase});
      await draw(f,'leadEndDrawingForAllRooms',{armedPhase:state.phase});continue;
    }
    if(state.phase==='RETURN_TO_MAIN') {await draw(f,'everyoneBack');continue;}
    if(state.phase==='ROUND_AGGREGATE') {await draw(f,'advanceFromAggregate');continue;}
    if(state.phase==='LEADERBOARD') {await draw(f,'dismissLeaderboard');continue;}
    if(state.phase.includes('SCORING')) {
      const describers=state.phase.startsWith('TUTORIAL')?[state.tutorial_describer_id]:state.teams.map(t=>t.describer_rotation[t.current_describer_index%t.describer_rotation.length]);
      for(const actor of f.players.filter(id=>!describers.includes(id))) await draw(f,'submitScoring',{participantId:actor,answers:Object.fromEntries(state.active_criteria.map(c=>[c.text,true]))},actor);
      continue;
    }
    await draw(f,'leadAdvanceTimedPhase',{armedPhase:state.phase});
  }
  const state=await drawingState(f);assert.equal(state.phase,'FINAL_RESULTS');assert.equal(state.total_rounds_played,3);
  for(const team of state.teams) assert.equal(team.cumulative_score,(team.member_ids.length-1)*18*3);
  const persisted=(await cluster.pool.query('SELECT name,cumulative_score FROM dibe_teams WHERE session_id=$1',[f.sessionId])).rows;
  for(const team of persisted) assert.equal(team.cumulative_score,state.teams.find(t=>t.name===team.name).cumulative_score);
  assert.equal(await status(f),'active');
  if(count===5) {
    await cluster.pool.query("INSERT INTO test_control.failures VALUES('sessions:UPDATE')");
    try {const response=await withRequestDatabase(cluster.database,f.players[0],()=>dibe(request({actionType:'endSession',payload:{},generation:1}),{params:{id:f.sessionId}}));assert.notEqual(response.status,200);}
    finally{await cluster.pool.query('DELETE FROM test_control.failures');}
    assert.deepEqual(await drawingState(f),state);assert.equal(await status(f),'active');
  }
  await draw(f,'endSession');assert.equal(await status(f),'completed');
});

for(const count of [2,8,24]) test(`R1/R3/R4/R8 Wrong Answers Only: four paired rounds at ${count} players score independent 15-point eliminations`,async()=>{
  const f=await seedWorkshop(cluster.pool,'wrong-answers-only',{headcount:count,status:'lobby'});await start(f);
  for(let number=1;number<=4;number++) {
    const started=await startWaoRound({admin:cluster.database,sessionId:f.sessionId});assert.equal(started.ok,true,JSON.stringify(started));
    const pairs=(await cluster.pool.query('SELECT * FROM wao_pairs WHERE round_id=$1',[started.round.id])).rows;
    const wrong=(await cluster.pool.query('SELECT id FROM wao_question_items WHERE question_id=$1 AND NOT is_correct ORDER BY id',[started.round.question_id])).rows;
    for(const pair of pairs) for(const actor of [pair.participant_a,pair.participant_b].filter(Boolean)) for(const [index,item] of wrong.entries()) {
      const body={itemId:item.id,action:'select',clientSeq:index+1};
      const response=await withRequestDatabase(cluster.database,actor,()=>tap(request(body),{params:{pairId:pair.id}}));assert.equal(response.status,200,await response.text());
    }
    await cluster.pool.query("UPDATE wao_rounds SET started_at=clock_timestamp()-interval '64 seconds' WHERE id=$1",[started.round.id]);
    if(count===2&&number===1) {
      await cluster.pool.query("INSERT INTO test_control.failures VALUES('wao_round_results:INSERT')");
      try {const response=await withRequestDatabase(cluster.database,pairs[0].participant_a,()=>close(request({}),{params:{pairId:pairs[0].id}}));assert.notEqual(response.status,200);}
      finally{await cluster.pool.query('DELETE FROM test_control.failures');}
      assert.equal((await cluster.pool.query('SELECT locked_at FROM wao_rounds WHERE id=$1',[started.round.id])).rows[0].locked_at,null);
    }
    for(let replay=0;replay<2;replay++) {const response=await withRequestDatabase(cluster.database,pairs[0].participant_a,()=>close(request({}),{params:{pairId:pairs[0].id}}));assert.equal(response.status,200,await response.text());}
    const results=(await cluster.pool.query('SELECT r.* FROM wao_round_results r JOIN wao_pairs p ON p.id=r.pair_id WHERE p.round_id=$1',[started.round.id])).rows;
    assert.equal(results.length,count/2);for(const result of results) {assert.equal(result.score,15);assert.equal(result.bonus,0);assert.equal(result.lott,0);}
  }
  const response=await withRequestDatabase(cluster.database,f.players[0],()=>end(request({}),{params:{sessionId:f.sessionId}}));assert.equal(response.status,200);assert.equal(await status(f),'completed');
  assert.deepEqual(await withRequestDatabase(cluster.database,f.players[0],()=>lobby.returnToLobbyAction(f.sessionId,1)),{ok:true});
  assert.equal((await cluster.pool.query('SELECT count(*)::int n FROM wao_sessions WHERE session_id=$1',[f.sessionId])).rows[0].n,0);
});
