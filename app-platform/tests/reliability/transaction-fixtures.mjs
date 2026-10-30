import { randomUUID } from 'node:crypto';

export async function seedWorkshop(pool, slug, { headcount = 4, status = 'active' } = {}) {
  const teamId = randomUUID();
  const sessionId = randomUUID();
  const players = Array.from({ length: headcount }, () => randomUUID());
  const { rows: [protocol] } = await pool.query('SELECT id FROM public.protocols WHERE slug = $1', [slug]);
  await pool.query('INSERT INTO public.teams(id,name) VALUES ($1,$2)', [teamId, 'Transactional test']);
  for (const [index, id] of players.entries()) await pool.query(
    'INSERT INTO public.participants(id,team_id,display_name,role) VALUES ($1,$2,$3,$4)',
    [id, teamId, `Player ${index}`, index === 0 ? 'lead' : 'member']);
  await pool.query(`INSERT INTO public.sessions(id,protocol_id,team_id,status) VALUES ($1,$2,$3,$4)`, [sessionId, protocol.id, teamId, status]);
  for (const [index, id] of players.entries()) await pool.query(
    'INSERT INTO public.session_participants(session_id,participant_id,role_in_session,connected) VALUES ($1,$2,$3,true)',
    [sessionId, id, index === 0 ? 'lead' : 'member']);
  await pool.query(`INSERT INTO public.session_state(session_id,phase) VALUES ($1,'write')`, [sessionId]);
  return { sessionId, teamId, players, protocolId: protocol.id };
}

export async function seedSwitchCode(pool, { type = 'unique', clues = ['fruit', 'fruit', 'red'] } = {}) {
  const fixture = await seedWorkshop(pool, 'code-switch');
  const roundId = randomUUID();
  const { rows: [word] } = await pool.query(`SELECT id FROM public.code_switch_words WHERE word = 'APPLE' LIMIT 1`);
  await pool.query(`INSERT INTO public.code_switch_sessions(session_id,phase) VALUES ($1,'write')`, [fixture.sessionId]);
  await pool.query(`INSERT INTO public.code_switch_rounds(id,session_id,round_index,guesser_id,word_id,round_type,write_started_at)
    VALUES ($1,$2,1,$3,$4,$5,clock_timestamp() - interval '10 minutes')`, [roundId, fixture.sessionId, fixture.players[0], word.id, type]);
  await pool.query('UPDATE public.code_switch_sessions SET current_round_id = $1 WHERE session_id = $2', [roundId, fixture.sessionId]);
  for (const [index, clue] of clues.entries()) await pool.query(
    'INSERT INTO public.code_switch_clues(round_id,participant_id,raw_text,normalized) VALUES ($1,$2,$3,$3)',
    [roundId, fixture.players[index + 1], clue]);
  return { ...fixture, roundId, wordId: word.id };
}

export async function seedSayLess(pool, { round = 1, lastCard = false, endedTurns = 0 } = {}) {
  const fixture = await seedWorkshop(pool, 'say-less');
  const teamId = randomUUID();
  const turnId = randomUUID();
  const { rows: cards } = await pool.query(`SELECT c.id FROM public.say_less_cards c JOIN public.content_packs p ON p.id = c.content_pack_id
    WHERE p.protocol_id = $1 ORDER BY c.sort_index, c.id LIMIT 2`, [fixture.protocolId]);
  const pile = (lastCard ? cards.slice(0, 1) : cards).map((card) => card.id);
  await pool.query(`INSERT INTO public.say_less_teams(id,session_id,label,member_ids) VALUES ($1,$2,'A',$3)`, [teamId, fixture.sessionId, fixture.players.slice(0, 2)]);
  await pool.query(`INSERT INTO public.say_less_sessions(session_id,phase,round,pile_card_ids,deck_card_ids,phase_deadline)
    VALUES ($1,'turn',$2,$3,$3,clock_timestamp() + interval '45 seconds')`, [fixture.sessionId, round, pile]);
  for (let index = 0; index < endedTurns; index++) await pool.query(`INSERT INTO public.say_less_turns(session_id,round,team_id,clue_giver_id,started_at,ended_at,end_reason)
    VALUES ($1,$2,$3,$4,clock_timestamp() - interval '1 minute',clock_timestamp(),'timer')`, [fixture.sessionId, round, teamId, fixture.players[0]]);
  await pool.query(`INSERT INTO public.say_less_turns(id,session_id,round,team_id,clue_giver_id,started_at)
    VALUES ($1,$2,$3,$4,$5,clock_timestamp())`, [turnId, fixture.sessionId, round, teamId, fixture.players[0]]);
  await pool.query(`UPDATE public.say_less_sessions SET current_turn_id = $1 WHERE session_id = $2`, [turnId, fixture.sessionId]);
  return { ...fixture, turnId, teamId, pile };
}

export async function switchSnapshot(pool, fixture) {
  const { rows: [session] } = await pool.query('SELECT * FROM public.code_switch_sessions WHERE session_id = $1', [fixture.sessionId]);
  const { rows: [round] } = await pool.query('SELECT * FROM public.code_switch_rounds WHERE id = $1', [fixture.roundId]);
  const { rows: clues } = await pool.query('SELECT * FROM public.code_switch_clues WHERE round_id = $1 ORDER BY id', [fixture.roundId]);
  const { rows: [pulse] } = await pool.query('SELECT * FROM public.session_state WHERE session_id = $1', [fixture.sessionId]);
  return { session, round, clues, pulse };
}

export async function sayLessSnapshot(pool, fixture) {
  const { rows: [session] } = await pool.query('SELECT * FROM public.say_less_sessions WHERE session_id = $1', [fixture.sessionId]);
  const { rows: [turn] } = await pool.query('SELECT * FROM public.say_less_turns WHERE id = $1', [fixture.turnId]);
  const { rows: events } = await pool.query('SELECT * FROM public.say_less_card_events WHERE turn_id = $1 ORDER BY id', [fixture.turnId]);
  const { rows: [pulse] } = await pool.query('SELECT * FROM public.session_state WHERE session_id = $1', [fixture.sessionId]);
  return { session, turn, events, pulse };
}
