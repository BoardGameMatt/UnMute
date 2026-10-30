import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { importApp, withRequestDatabase } from './runtime.mjs';
import { startPostgres, PostgresDatabase } from './postgres.mjs';
import { seedWorkshop } from './transaction-fixtures.mjs';

let cluster;
const lobby = await importApp('app/(site)/session/[session_id]/lobby/actions.ts');
const modules = {};
for (const slug of ['talk-track','rank-and-file','i-know-what-you-meme','the-truth-is','airtime','zoning-rights','on-the-same-page']) modules[slug] = await importApp(`lib/protocols/${slug}/actions.ts`);
before(async () => {
  cluster = await startPostgres();
  const {rows:[pack]}=await cluster.pool.query("SELECT c.id FROM content_packs c JOIN protocols p ON p.id=c.protocol_id WHERE p.slug='talk-track' AND c.slug='a'");
  await cluster.pool.query('UPDATE talk_track_cards SET active=false WHERE content_pack_id=$1',[pack.id]);
  const csv=await readFile(new URL('../../supabase/seed-data/talk-track-packs-ab.csv',import.meta.url),'utf8');
  const cards=csv.trim().split(/\r?\n/).slice(1).map(line=>line.split(',')).filter(parts=>parts[0]==='A');
  assert.equal(cards.length,30);
  for(const card of cards) await cluster.pool.query('INSERT INTO talk_track_cards(content_pack_id,word_1,word_2,word_3,word_4,word_5) VALUES ($1,$2,$3,$4,$5,$6)',[pack.id,...card.slice(2).map(word=>word.trim().toUpperCase())]);
});
after(async () => { await cluster?.close(); });
const row = async (table, f) => (await cluster.pool.query(`SELECT * FROM ${table} WHERE session_id=$1`, [f.sessionId])).rows[0];
const snapshot = async f => {
  const result = await cluster.database.rpc('load_workshop_transaction', { p_session_id: f.sessionId });
  assert.equal(result.error, null); return result.data;
};
async function fixture(slug, headcount) {
  const f = await seedWorkshop(cluster.pool, slug, { headcount, status: 'lobby' });
  await assert.rejects(withRequestDatabase(cluster.database, f.players[0], () => lobby.startSessionAction(f.sessionId, 0)), /NEXT_REDIRECT:/);
  f.slug = slug;
  return f;
}
function send(f, action, actor=f.players[0], database=cluster.database) {
  const dispatch = Object.entries(modules[f.slug]).find(([name]) => /^dispatch.*Action$/.test(name))[1];
  return dispatch({ admin: database, sessionId: f.sessionId, participantId: actor, isLead: actor===f.players[0], isDisplay: false,
    canControl: actor===f.players[0], action: { operationId: randomUUID(), ...action, ...(f.slug==='on-the-same-page' ? { actorId: actor } : {}) } });
}
async function accepted(f, action, actor) { const result = await send(f, action, actor); assert.equal(result.ok, true, JSON.stringify({ slug:f.slug, action, result })); return result; }

/** Capture the real commit plan while SQL fails, then fail each visited write. */
async function faults(f, execute) {
  let operations;
  const database = new PostgresDatabase(cluster.servicePool, { beforeRpc: (name,args) => { if(name==='commit_workshop_transaction') operations=args.p_operations; } });
  const before = await snapshot(f);
  await cluster.pool.query("INSERT INTO test_control.failures VALUES ('session_state:UPDATE')");
  try { const result=await execute(database); assert.equal(result.ok,false); assert.match(result.error,/Injected storage failure/); }
  finally { await cluster.pool.query('DELETE FROM test_control.failures'); }
  assert.deepEqual(await snapshot(f), before);
  assert.ok(operations?.length);
  const points = new Set(operations.map(op=>`${op.table}:${op.kind.toUpperCase()}`));
  for(const point of points) {
    await cluster.pool.query('INSERT INTO test_control.failures VALUES ($1)',[point]);
    try { const result=await execute(cluster.database); assert.equal(result.ok,false,point); assert.match(result.error,/Injected storage failure/,point); }
    finally { await cluster.pool.query('DELETE FROM test_control.failures'); }
    assert.deepEqual(await snapshot(f), before,point);
  }
}
async function assertComplete(f) { assert.equal((await cluster.pool.query('SELECT status FROM sessions WHERE id=$1',[f.sessionId])).rows[0].status,'completed'); }

for (const headcount of [4,10,20]) test(`R1/R3/R8 Talk Track: complete two cycles at ${headcount} players with independent 15-point turns`, async () => {
  const f=await fixture('talk-track',headcount);
  let scored=0;
  for(let step=0;step<150;step++) {
    const state=await row('talk_track_sessions',f);
    if(state.phase==='final_scores') break;
    if(state.phase==='another_round') { await accepted(f,{type:'anotherRound',yes:false}); continue; }
    if(state.phase==='team_reveal'||state.phase==='hold') { await accepted(f,{type:'advanceHold'}); continue; }
    assert.equal(state.phase,'turn');
    const turn=(await cluster.pool.query('SELECT * FROM talk_track_turns WHERE id=$1',[state.current_turn_id])).rows[0];
    const actor=turn.train_ids[0];
    if(turn.subphase==='cluing') { await accepted(f,{type:'stop'},actor); continue; }
    const action={type:'resolve',outcome:'got_it',operationId:randomUUID()};
    if(headcount===4&&scored===0&&turn.card_id) await faults(f,db=>send(f,action,actor,db));
    await accepted(f,action,actor);
    await accepted(f,action,actor); // lost acknowledgement: same durable operation
    if(turn.card_id) scored++;
  }
  const teams=(await cluster.pool.query('SELECT score FROM talk_track_teams WHERE session_id=$1',[f.sessionId])).rows;
  assert.ok(teams.length>0); for(const team of teams) assert.equal(team.score,30,JSON.stringify({teams,scored,state:await row('talk_track_sessions',f)}));
  assert.equal(scored,teams.length*10);
  await accepted(f,{type:'complete'}); await assertComplete(f);
});

for (const headcount of [3,8,20]) test(`R1/R3/R8 Rank and File: five exact rounds at ${headcount} players score exactly five`,async()=>{
  const f=await fixture('rank-and-file',headcount);
  for(let round=1;round<=5;round++) {
    const state=await row('rank_and_file_sessions',f);
    const deals=(await cluster.pool.query('SELECT * FROM rank_and_file_deals WHERE round_id=$1 ORDER BY dealt_number',[state.current_round_id])).rows;
    for(const [index,deal] of deals.entries()) await accepted(f,{type:'lockClue',text:`Sample clue ${String.fromCharCode(65+index)}`},deal.participant_id);
    await accepted(f,{type:'setRail',dealIds:deals.map(deal=>deal.id)});
    const commit={type:'commit',operationId:randomUUID()};
    if(headcount===3&&round===1) await faults(f,db=>send(f,commit,f.players[0],db));
    await accepted(f,commit); await accepted(f,commit);
    assert.equal((await row('rank_and_file_sessions',f)).hits,round);
    if(round<5) await accepted(f,{type:'nextRound'});
  }
  await accepted(f,{type:'wrap'}); await accepted(f,{type:'advanceRecap'}); await assertComplete(f);
});

for(const headcount of [3,8,20]) test(`R1/R3/R8 I Know What You Meme: both collections and every reveal at ${headcount} players`,async()=>{
  const f=await fixture('i-know-what-you-meme',headcount);
  for(let round=1;round<=2;round++) {
    await accepted(f,{type:'broadcastRound'});
    for(const actor of f.players) await accepted(f,{type:'confirmGif',gifUrl:'https://media.giphy.com/media/test/giphy.gif',openResponse:'calm',stimulusResponse:'soup',searchQuery:'calm soup'},actor);
  }
  const items=(await cluster.pool.query('SELECT * FROM ikwym_reveal_items WHERE session_id=$1 ORDER BY sort_index',[f.sessionId])).rows;
  assert.equal(items.length,2*headcount);
  for(const [index,item] of items.entries()) {
    const guessers=f.players.filter(id=>id!==item.owner_id);
    for(const [gi,actor] of guessers.entries()) {
      const action={type:'lockGuess',guessedParticipantId:item.owner_id,operationId:randomUUID()};
      if(headcount===3&&index===0&&gi===guessers.length-1) await faults(f,db=>send(f,action,actor,db));
      await accepted(f,action,actor); await accepted(f,action,actor);
    }
    assert.equal((await row('ikwym_sessions',f)).phase,'REVEAL_SHOW');
    await accepted(f,{type:'nextReveal'});
  }
  const roster=f.players.map(participantId=>({participantId,displayName:participantId}));
  const scores=await modules[f.slug].scoresForSession(cluster.database,f.sessionId,roster);
  for(const score of Object.values(scores)) assert.equal(score,2*(headcount-1));
  await accepted(f,{type:'advanceRecap'}); await assertComplete(f);
});

for(const headcount of [2,8,16]) test(`R1/R3/R8 Airtime: five safe dives at ${headcount} players preserve banked items and events`,async()=>{
  const f=await fixture('airtime',headcount);
  const expected=new Map();
  for(let dive=1;dive<=5;dive++) {
    await accepted(f,{type:dive===1?'startDive':'nextDive'});
    const state=await row('airtime_sessions',f);
    for(const diver of state.dive_state_json.divers) {
      const expectedValue=Number(diver.itemId.match(/^l1-/) ? ({'l1-lost-flip-flop':0,'l1-tangled-fishing-line':0,'l1-scallop-shell':1,'l1-piece-of-sea-glass':1,'l1-pair-of-sunglasses':2,'l1-message-in-a-bottle':2})[diver.itemId] : NaN);
      assert.ok(Number.isFinite(expectedValue)); expected.set(`${dive}:${diver.participantId}`,expectedValue);
    }
    for(const [index,actor] of f.players.entries()) {
      const action={type:'choose',choice:'up',turn:1,operationId:randomUUID()};
      if(headcount===2&&dive===1&&index===headcount-1) await faults(f,db=>send(f,action,actor,db));
      await accepted(f,action,actor); await accepted(f,action,actor);
    }
    assert.equal((await row('airtime_sessions',f)).phase,'dive_results');
    const hauls=(await cluster.pool.query('SELECT * FROM airtime_diver_dives WHERE session_id=$1 AND dive_number=$2',[f.sessionId,dive])).rows;
    assert.equal(hauls.length,headcount);
    for(const haul of hauls) { assert.equal(haul.status,'surfaced'); assert.equal(haul.haul,expected.get(`${dive}:${haul.participant_id}`)); }
  }
  await accepted(f,{type:'finalScore'}); await accepted(f,{type:'advanceRecap'}); await assertComplete(f);
});

for(const headcount of [3,8,20]) test(`R1/R3/R8 The Truth Is: two submissions, three scored reads, and debrief at ${headcount} players`,async()=>{
  const f=await fixture('the-truth-is',headcount);
  const store=await importApp('lib/protocols/the-truth-is/store.ts');
  for(let round=1;round<=2;round++) for(const [index,actor] of f.players.entries()) await accepted(f,{type:'submitEntry',round,text:`I once made sample story ${round} ${index}.`},actor);
  const expected=Object.fromEntries(f.players.map(id=>[id,0]));
  for(let step=0;step<50;step++) {
    const state=await store.loadTruthIsState(cluster.database,f.sessionId);
    if(state.phase==='RESULTS') break;
    if(state.phase==='WRAP_UP') { await accepted(f,{type:state.total_rounds_played>=3?'wrapUp':'oneMoreRound'}); continue; }
    if(state.phase==='LEADERBOARD') { await accepted(f,{type:'dismissLeaderboard'}); continue; }
    if(state.phase==='DISCUSSION') { await accepted(f,{type:'readyToVote'},state.current_reader_id); continue; }
    if(state.phase==='VOTING') {
      const author=state.current_author_id;
      assert.ok(author);
      for(const actor of f.players) await accepted(f,{type:'submitVote',guessedAuthorId:author},actor);
      for(const actor of f.players) if(actor!==author) expected[actor]++;
      continue;
    }
    if(state.phase==='REVEAL') {
      const action={type:'processReveal',operationId:randomUUID()};
      if(headcount===3&&state.total_rounds_played===0) await faults(f,db=>send(f,action,f.players[0],db));
      await accepted(f,action); await accepted(f,action); continue;
    }
    assert.fail(`Unexpected phase ${state.phase}`);
  }
  const result=await store.loadTruthIsState(cluster.database,f.sessionId);
  assert.equal(result.phase,'RESULTS'); assert.equal(result.total_rounds_played,3);
  assert.deepEqual(result.scores,expected);
  await accepted(f,{type:'advanceRecap'}); await assertComplete(f);
});

for(const headcount of [3,8,20]) test(`R1/R3/R8 Zoning Rights: three individual and three team rounds at ${headcount} players`,async()=>{
  const f=await fixture('zoning-rights',headcount);
  const engine=await importApp('lib/protocols/zoning-rights/engine.ts');
  for(let index=0;index<6;index++) {
    let state=await row('zoning_rights_sessions',f);
    if(state.phase==='TEAM_INTRO') { await accepted(f,{type:'continue'}); state=await row('zoning_rights_sessions',f); }
    let round=(await cluster.pool.query('SELECT * FROM zoning_rights_rounds WHERE id=$1',[state.current_round_id])).rows[0];
    const cells=engine.legalLots(state.board_json).slice(0,round.k);
    assert.equal(cells.length,round.k);
    await accepted(f,{type:'lockLots',cells},round.planner_id);
    round=(await cluster.pool.query('SELECT * FROM zoning_rights_rounds WHERE id=$1',[round.id])).rows[0];
    const assignment=Object.fromEntries(round.lots_json.map((lot,i)=>[lot.letter,round.building_ids[i]]));
    await accepted(f,{type:'lockZmAssignment',assignment},round.zm_id);
    if(index<3) {
      const guessers=f.players.filter(id=>id!==round.zm_id);
      for(const [gi,actor] of guessers.entries()) {
        const action={type:'lockGuess',assignment,operationId:randomUUID()};
        if(headcount===3&&index===0&&gi===guessers.length-1) await faults(f,db=>send(f,action,actor,db));
        await accepted(f,action,actor); await accepted(f,action,actor);
      }
      const guesses=(await cluster.pool.query('SELECT * FROM zoning_rights_guesses WHERE round_id=$1',[round.id])).rows;
      assert.equal(guesses.length,headcount-1); assert.ok(guesses.every(guess=>guess.is_exact===true));
    } else {
      round=(await cluster.pool.query('SELECT * FROM zoning_rights_rounds WHERE id=$1',[round.id])).rows[0];
      await accepted(f,{type:'lockTeam',assignment},round.lead_developer_id);
    }
    if(index===2) await accepted(f,{type:'moveToTeamPlay'});
    else if(index<5) await accepted(f,{type:'continue'});
  }
  await accepted(f,{type:'complete'}); await assertComplete(f);
  const {rows:[count]}=await cluster.pool.query('SELECT count(*)::int AS n FROM zoning_rights_rounds WHERE session_id=$1 AND ended_at IS NOT NULL',[f.sessionId]);
  assert.equal(count.n,6);
});

for(const headcount of [8,12,16]) test(`R1/R3/R8 On the Same Page: three scored rounds and rotation debt at ${headcount} players`,async()=>{
  const f=await fixture('on-the-same-page',headcount);
  const expected=Object.fromEntries(f.players.map(id=>[id,0]));
  for(let number=1;number<=3;number++) {
    let game=(await row('otsp_sessions',f)).game_json;
    if(game.phase==='deal') {
      await cluster.pool.query("UPDATE otsp_sessions SET game_json=jsonb_set(game_json,'{round,phaseEndsAt}',to_jsonb($2::bigint)) WHERE session_id=$1",[f.sessionId,Date.now()-3000]);
      await accepted(f,{type:'expire'}); game=(await row('otsp_sessions',f)).game_json;
    }
    for(const actor of f.players.filter(id=>game.round.roles[id]!=='improviser')) await accepted(f,{type:'pin',targetId:game.round.improviserId},actor);
    const inspectors=f.players.filter(id=>game.round.roles[id]==='inspector');
    for(const actor of inspectors) await accepted(f,{type:'guess',itemId:game.round.pictureId},actor);
    for(const actor of f.players) expected[actor]+=game.round.roles[actor]==='inspector'?7:game.round.roles[actor]==='builder'?5:0;
    for(let step=0;step<40;step++) {
      game=(await row('otsp_sessions',f)).game_json;
      if(game.phase==='reveal'&&game.round.revealStep==='outcome') break;
      await cluster.pool.query("UPDATE otsp_sessions SET game_json=jsonb_set(game_json,'{round,phaseEndsAt}',to_jsonb($2::bigint)) WHERE session_id=$1",[f.sessionId,Date.now()-3000]);
      const action={type:'expire',operationId:randomUUID()};
      if(headcount===8&&number===1&&game.phase==='final_lock') await faults(f,db=>send(f,action,f.players[0],db));
      await accepted(f,action);
    }
    game=(await row('otsp_sessions',f)).game_json;
    assert.equal(game.phase,'reveal'); assert.equal(game.round.revealStep,'outcome');
    assert.deepEqual(game.totals,expected);
    if(number<3) await accepted(f,{type:'anotherRound'});
  }
  await accepted(f,{type:'scoreboard'});
  assert.equal((await modules[f.slug].finishOnTheSamePage({admin:cluster.database,sessionId:f.sessionId,canControl:true})).ok,true);
  await assertComplete(f);
  const {rows:debts}=await cluster.pool.query('SELECT * FROM otsp_rotation_debt WHERE team_id=$1',[f.teamId]);
  assert.ok(debts.every(debt=>f.players.includes(debt.participant_id)));
});
