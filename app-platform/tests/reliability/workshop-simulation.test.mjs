import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { startPostgres } from './postgres.mjs';
import { seedWorkshop } from './transaction-fixtures.mjs';
import { importApp, withRequestDatabase } from './runtime.mjs';

pg.types.setTypeParser(1184, (value) => new Date(value).toISOString());
const cs = await importApp('lib/protocols/code-switch/actions.ts');
const sl = await importApp('lib/protocols/say-less/actions.ts');
const { buildSayLessPlayState } = await importApp('lib/protocols/say-less/play-state.ts');
const { startSessionAction } = await importApp('app/(site)/session/[session_id]/lobby/actions.ts');
let cluster;
before(async () => { cluster = await startPostgres(); }, { timeout: 120000 });
after(async () => { await cluster?.close(); });
async function start(fixture) {
  try { const result = await withRequestDatabase(cluster.database, fixture.players[0], () => startSessionAction(fixture.sessionId, 0)); assert.fail(JSON.stringify(result)); }
  catch (error) { assert.match(error.message, /^NEXT_REDIRECT:/); }
}
const codeAction = (fixture, actor, action) => cs.dispatchCodeSwitchAction({ admin: cluster.database,
  sessionId: fixture.sessionId, participantId: actor, isLead: actor === fixture.players[0], action });
const sayAction = (fixture, actor, action) => sl.dispatchSayLessAction({ admin: cluster.database,
  sessionId: fixture.sessionId, participantId: actor, isLead: actor === fixture.players[0], action });
const queryOne = async (sql, args) => (await cluster.pool.query(sql, args)).rows[0];
const clueWords = ['orchard','forest','river','cloud','stone','chair','pencil','window','bridge','garden','flower','music',
  'silver','yellow','happy','quiet','night','summer','winter','water','mountain','zebra','harbor'];

for (const headcount of [4, 8, 20]) {
  test(`R8 full SwitchCode workshop: ${headcount} players, full guesser rotation, independent totals`, { timeout: 120000 }, async () => {
    const fixture = await seedWorkshop(cluster.pool, 'code-switch', { headcount, status: 'lobby' });
    await start(fixture);
    const guessers = new Set(); const usedWords = new Set(); let expectedHits = 0;
    for (let index = 0; index < headcount; index++) {
      const round = await queryOne(`SELECT r.*,w.word FROM code_switch_rounds r JOIN code_switch_words w ON w.id=r.word_id
        JOIN code_switch_sessions s ON s.current_round_id=r.id WHERE s.session_id=$1`, [fixture.sessionId]);
      assert.equal(guessers.has(round.guesser_id), false); guessers.add(round.guesser_id);
      assert.equal(usedWords.has(round.word_id), false); usedWords.add(round.word_id);
      const words = clueWords.filter((word) => word !== round.word.toLowerCase());
      const givers = fixture.players.filter((id) => id !== round.guesser_id);
      const results = await Promise.all(givers.map((actor, n) => codeAction(fixture, actor,
        { type: 'lockClue', text: round.round_type === 'shared' ? words[0] : words[n], roundId: round.id })));
      assert.ok(results.every((result) => result.ok), JSON.stringify(results));
      const board = await queryOne('SELECT phase,filtered_clues_json FROM code_switch_sessions s JOIN code_switch_rounds r ON r.id=s.current_round_id WHERE s.session_id=$1', [fixture.sessionId]);
      assert.equal(board.phase, 'guess');
      assert.equal(board.filtered_clues_json.length, round.round_type === 'shared' ? 1 : headcount - 1);
      const hit = index % 3 !== 0;
      const guess = { type: 'lockGuess', text: hit ? round.word : 'incorrectanswer', roundId: round.id };
      assert.equal((await codeAction(fixture, round.guesser_id, guess)).ok, true);
      assert.equal((await codeAction(fixture, round.guesser_id, guess)).ok, true, 'Identical guess retry acknowledged');
      if (hit) expectedHits++;
      assert.equal((await queryOne('SELECT team_score FROM code_switch_sessions WHERE session_id=$1', [fixture.sessionId])).team_score, expectedHits);
      if (index < headcount - 1) assert.equal((await codeAction(fixture, fixture.players[0], { type: 'anotherRound' })).ok, true);
    }
    assert.equal(guessers.size, headcount);
    assert.equal((await codeAction(fixture, fixture.players[0], { type: 'wrap' })).ok, true);
    const stats = await cs.shownStatsForSession(cluster.database, fixture.sessionId,
      fixture.players.map((id, n) => ({ participantId: id, displayName: `Player ${n}`, connected: true, isLead: n === 0 })));
    for (const row of stats) { assert.equal(row.clueRounds, headcount - 1); assert.equal(row.shownCount, headcount - 1); }
    assert.equal((await codeAction(fixture, fixture.players[0], { type: 'advanceRecap' })).ok, true);
    assert.equal((await queryOne('SELECT status FROM sessions WHERE id=$1', [fixture.sessionId])).status, 'completed');
  });
}

for (const headcount of [4, 8, 14]) {
  test(`R8 full Say Less workshop: ${headcount} players, 20-card deck, both rounds and independent team scores`, { timeout: 120000 }, async () => {
    const fixture = await seedWorkshop(cluster.pool, 'say-less', { headcount, status: 'lobby' });
    await start(fixture);
    const teams = (await cluster.pool.query('SELECT * FROM say_less_teams WHERE session_id=$1 ORDER BY label', [fixture.sessionId])).rows;
    assert.deepEqual(teams.map((team) => team.member_ids.length), [Math.ceil(headcount / 2), Math.floor(headcount / 2)]);
    const deck = (await queryOne('SELECT deck_card_ids FROM say_less_sessions WHERE session_id=$1', [fixture.sessionId])).deck_card_ids;
    assert.equal(deck.length, 20); assert.equal(new Set(deck).size, 20);
    assert.equal((await sayAction(fixture, fixture.players[0], { type: 'confirmTeams' })).ok, true);
    const previews = (await cluster.pool.query('SELECT card_ids FROM say_less_previews WHERE session_id=$1', [fixture.sessionId])).rows;
    assert.equal(previews.length, headcount);
    for (const row of previews) { assert.equal(new Set(row.card_ids).size, 2); assert.ok(row.card_ids.every((id) => deck.includes(id))); }
    await cluster.pool.query(`UPDATE say_less_sessions SET phase_deadline=clock_timestamp()-interval '1 second' WHERE session_id=$1`, [fixture.sessionId]);
    await sl.advanceIfDue(cluster.database, fixture.sessionId);
    const expected = new Map(teams.map((team) => [team.id, 0]));
    const givers = new Set();
    for (const round of [1, 2]) {
      assert.equal((await sayAction(fixture, fixture.players[0], { type: 'startRound' })).ok, true);
      let priorTeam; let turnIndex = 0;
      while (true) {
        const row = await queryOne('SELECT * FROM say_less_sessions WHERE session_id=$1', [fixture.sessionId]);
        if (row.phase === 'round_break' || row.phase === 'final_scores') break;
        assert.equal(row.phase, 'turn'); assert.equal(row.round, round);
        const turn = await queryOne('SELECT * FROM say_less_turns WHERE id=$1', [row.current_turn_id]);
        givers.add(turn.clue_giver_id); if (priorTeam) assert.notEqual(turn.team_id, priorTeam); priorTeam = turn.team_id;
        if (round === 2 && turnIndex % 4 === 0) {
          const pass = { type: 'cardAction', outcome: 'pass', cardId: row.pile_card_ids[0], operationId: randomUUID(), turnId: turn.id, expectedVersion: row.version };
          assert.equal((await sayAction(fixture, turn.clue_giver_id, pass)).ok, true);
          assert.equal((await sayAction(fixture, turn.clue_giver_id, pass)).ok, true);
        }
        const current = await queryOne('SELECT * FROM say_less_sessions WHERE session_id=$1', [fixture.sessionId]);
        const tap = { type: 'cardAction', outcome: 'got_it', cardId: current.pile_card_ids[0], operationId: randomUUID(), turnId: turn.id, expectedVersion: current.version };
        assert.equal((await sayAction(fixture, turn.clue_giver_id, tap)).ok, true);
        assert.equal((await sayAction(fixture, turn.clue_giver_id, tap)).ok, true);
        expected.set(turn.team_id, expected.get(turn.team_id) + 1);
        const after = await queryOne('SELECT * FROM say_less_sessions WHERE session_id=$1', [fixture.sessionId]);
        if (after.phase === 'round_break' || after.phase === 'final_scores') break;
        // Exercise timeout, skipped turns, timed hold, and the ten-turn pause.
        if (turnIndex % 2 === 0) {
          await cluster.pool.query(`UPDATE say_less_sessions SET phase_deadline=clock_timestamp()-interval '1 second' WHERE session_id=$1`, [fixture.sessionId]);
          await sl.advanceIfDue(cluster.database, fixture.sessionId);
        } else assert.equal((await sayAction(fixture, fixture.players[0], { type: 'skipTurn' })).ok, true);
        const hold = await queryOne('SELECT * FROM say_less_sessions WHERE session_id=$1', [fixture.sessionId]);
        assert.equal(hold.phase, 'hold');
        if (hold.paused) assert.equal((await sayAction(fixture, fixture.players[0], { type: 'resumeHold' })).ok, true);
        await cluster.pool.query(`UPDATE say_less_sessions SET phase_deadline=clock_timestamp()-interval '1 second' WHERE session_id=$1`, [fixture.sessionId]);
        await sl.advanceIfDue(cluster.database, fixture.sessionId);
        assert.ok(++turnIndex < 40, 'Bounded full-round progression');
      }
      const view = await buildSayLessPlayState({ admin: cluster.database, sessionId: fixture.sessionId, participantId: fixture.players[0], isLead: true });
      assert.equal(view.scores.length, 2);
      for (const team of teams) assert.equal(view.scores.find((score) => score.label === team.label).score, expected.get(team.id));
      assert.equal(view.scores.reduce((sum, score) => sum + score.score, 0), round * 20);
    }
    assert.equal(givers.size, headcount);
    assert.equal((await sayAction(fixture, fixture.players[0], { type: 'complete' })).ok, true);
    assert.equal((await queryOne('SELECT status FROM sessions WHERE id=$1', [fixture.sessionId])).status, 'completed');
    const events = (await cluster.pool.query(`SELECT t.round,e.card_id,e.outcome FROM say_less_card_events e JOIN say_less_turns t ON t.id=e.turn_id WHERE t.session_id=$1`, [fixture.sessionId])).rows;
    for (const round of [1, 2]) assert.equal(new Set(events.filter((event) => event.round === round && event.outcome === 'got_it').map((event) => event.card_id)).size, 20);
  });
}
