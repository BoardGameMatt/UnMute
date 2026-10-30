import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import pg from 'pg';
import { appRoot, importApp, withRequestDatabase } from '../reliability/runtime.mjs';
import { startPostgres } from '../reliability/postgres.mjs';
import { seedSwitchCode, seedSayLess, seedWorkshop } from '../reliability/transaction-fixtures.mjs';

pg.types.setTypeParser(1184, (value) => new Date(value).toISOString());
const routes = new Map();
const lobbyActions = await importApp('app/(site)/session/[session_id]/lobby/actions.ts');
for (const slug of ['code-switch', 'say-less', 'talk-track', 'zoning-rights', 'ikwym', 'rank-and-file', 'the-truth-is', 'airtime', 'on-the-same-page', 'cover-story']) {
  for (const operation of ['play', 'action']) {
    routes.set(`${slug}/${operation}`, await importApp(`app/api/${slug}/session/[sessionId]/${operation}/route.ts`));
  }
}
for (const op of ['play','start-round','end','facilitator-status','scoreboard']) routes.set(`wao/${op}`,await importApp(`app/api/wao/session/[sessionId]/${op}/route.ts`));
for (const op of ['tap','state','close-timer','reveal']) routes.set(`wao/pair/${op}`,await importApp(`app/api/wao/pair/[pairId]/${op}/route.ts`));

routes.set('dibe/action',await importApp('app/api/session/[id]/action/route.ts'));

// Actual UI, provider, Supabase browser client, API handlers, engines and SQL.
// Only the Next page shell/navigation and PostgREST transport are adapted here.
// Realtime sockets deliberately receive NO notifications: recovery must work
// without delivery. This does not emulate or certify Supabase Realtime itself.
export async function startBrowserServer() {
  const cluster = await startPostgres();
  const fixtures = new Map();
  const requests = [];
  let javascript;
  let css;
  const server = createServer(async (incoming, outgoing) => {
    const url = new URL(incoming.url, origin);
    const send = (status, body, type = 'application/json') => {
      outgoing.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      outgoing.end(type === 'application/json' ? JSON.stringify(body) : body);
    };
    try {
      if (url.pathname === '/app.js') return send(200, javascript, 'text/javascript');
      if (url.pathname === '/app.css') return send(200, css, 'text/css');
      if (url.pathname === '/favicon.ico') return send(204, '');
      const lifecycle = url.pathname.match(/^\/__test\/start\/([a-f0-9-]+)$/);
      if (lifecycle) {
        if (!fixtures.has(lifecycle[1]) || incoming.method !== 'POST') return send(404, {});
        const actor = incoming.headers.cookie?.match(/(?:^|;\s*)unmute_participant_id=([^;]+)/)?.[1];
        const chunks = []; for await (const chunk of incoming) chunks.push(chunk);
        const { version } = JSON.parse(Buffer.concat(chunks).toString());
        try {
          const result = await withRequestDatabase(cluster.database, actor, () => lobbyActions.startSessionAction(lifecycle[1], version));
          return send(200, result ?? {});
        } catch (error) {
          if (error.message.startsWith('NEXT_REDIRECT:')) return send(200, { ok: true });
          throw error;
        }
      }
      if (url.pathname === '/supabase/rest/v1/session_state') {
        const id = url.searchParams.get('session_id')?.replace(/^eq\./, '');
        const { rows } = await cluster.pool.query(`SELECT st.*, st.revision::float8 AS revision, json_build_object('status', s.status) AS sessions
          FROM session_state st JOIN sessions s ON s.id=st.session_id WHERE session_id = $1`, [id]);
        return send(200, rows[0] ?? null);
      }
      if (url.pathname === '/supabase/rest/v1/sessions') {
        const id = url.searchParams.get('id')?.replace(/^eq\./, '');
        const { rows } = await cluster.pool.query('SELECT id,status,lifecycle_version FROM sessions WHERE id=$1', [id]);
        return send(200, rows[0] ?? null);
      }
      const shell = url.pathname.match(/^\/workshop\/([a-f0-9-]+)$/);
      if (shell) {
        const actor = url.searchParams.get('actor');
        const { rows: [session] } = await cluster.pool.query('SELECT * FROM sessions WHERE id=$1', [shell[1]]);
        const { rows: [participant] } = await cluster.pool.query('SELECT * FROM participants WHERE id=$1', [actor]);
        const fixture = fixtures.get(shell[1]);
        if (!session || !participant || !fixture?.players.includes(actor)) return send(404, { error: 'Unknown browser fixture' });
        outgoing.setHeader('Set-Cookie', `unmute_participant_id=${actor}; Path=/; HttpOnly; SameSite=Lax`);
        const { rows: participants } = await cluster.pool.query(`SELECT sp.id AS "sessionParticipantId",sp.participant_id AS "participantId",
          sp.role_in_session AS "roleInSession",p.display_name AS "displayName" FROM session_participants sp
          JOIN participants p ON p.id=sp.participant_id WHERE sp.session_id=$1`, [session.id]);
        const boot = JSON.stringify({ session, currentParticipant: participant, participants,
          roleInSession: actor === fixture.players[0] ? 'lead' : 'member',
          slug: fixture.slug, screen: url.searchParams.get('screen') === '1', hook: url.searchParams.get('hook') === '1', probe: url.searchParams.get('probe') === '1', navProbe: url.searchParams.get('nav') === '1', lobby: url.searchParams.get('lobby') === '1' }).replaceAll('<', '\\u003c');
        return send(200, `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><title>Workshop recovery</title></head><body class="bg-warm-white"><main id="root"></main><script id="bootstrap" type="application/json">${boot}</script><script src="/app.js"></script></body></html>`, 'text/html');
      }
      const api = url.pathname.match(/^\/api\/(code-switch|say-less|talk-track|zoning-rights|ikwym|rank-and-file|the-truth-is|airtime|on-the-same-page|cover-story|wao)\/session\/([a-f0-9-]+)\/(play|action|start-round|end|facilitator-status|scoreboard)$/);
      const dibeApi = url.pathname.match(/^\/api\/session\/([a-f0-9-]+)\/action$/);
      const pairApi = url.pathname.match(/^\/api\/wao\/pair\/([a-f0-9-]+)\/(tap|state|close-timer|reveal)$/);
      if (api || pairApi || dibeApi) {
        const actor = incoming.headers.cookie?.match(/(?:^|;\s*)unmute_participant_id=([^;]+)/)?.[1];
        const chunks = [];
        for await (const chunk of incoming) chunks.push(chunk);
        const body = Buffer.concat(chunks).toString();
        requests.push({ path: url.pathname, actor, body: body ? JSON.parse(body) : null });
        const request = new Request(url, { method: incoming.method, headers: { 'Content-Type': 'application/json' },
          ...(incoming.method === 'POST' ? { body } : {}) });
        const response = await withRequestDatabase(cluster.database, actor, () =>
          dibeApi ? routes.get('dibe/action')[incoming.method](request,{params:{id:dibeApi[1]}})
          : pairApi ? routes.get(`wao/pair/${pairApi[2]}`)[incoming.method](request,{params:{pairId:pairApi[1]}})
          : routes.get(`${api[1]}/${api[3]}`)[incoming.method](request, { params: { sessionId: api[2] } }));
        outgoing.writeHead(response.status, Object.fromEntries(response.headers));
        return outgoing.end(await response.text());
      }
      return send(404, { error: 'No test route' });
    } catch (error) { return send(500, { error: String(error) }); }
  });
  // An intentionally unavailable Realtime transport, rather than a mock that
  // promises successful delivery. Browser tests also block sockets explicitly.
  server.on('upgrade', (_request, socket) => socket.destroy());
  let origin;
  try {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    origin = `http://127.0.0.1:${server.address().port}`;
    const result = await build({
      stdin: { contents: `import React from 'react'; import { createRoot } from 'react-dom/client';
        import { SessionProvider, useGameState } from './components/providers/SessionProvider';
        import CodeSwitch from './lib/protocols/code-switch/CodeSwitchProtocol';
        import SayLess from './lib/protocols/say-less/SayLessProtocol';
        import { ScoringCriteriaForm } from './lib/protocols/draw-it-by-ear/components/ScoringCriteriaForm';
        import { useDibeTimerRecovery } from './lib/protocols/draw-it-by-ear/hooks/useDibeTimerRecovery';
        import TruthIs from './lib/protocols/the-truth-is/TheTruthIsProtocol';
        import RankAndFile from './lib/protocols/rank-and-file/RankAndFileProtocol';
        import Ikwym from './lib/protocols/i-know-what-you-meme/IKWYMProtocol';
        import { useTalkTrackPlay } from './lib/protocols/talk-track/use-talk-track-play';
        import { useZoningRightsPlay } from './lib/protocols/zoning-rights/use-zoning-rights-play';
        import { useIkwymPlay } from './lib/protocols/i-know-what-you-meme/use-ikwym-play';
        import { useRankAndFilePlay } from './lib/protocols/rank-and-file/use-rank-and-file-play';
        import { useTruthIsPlay } from './lib/protocols/the-truth-is/use-truth-is-play';
        import { useAirtimePlay } from './lib/protocols/airtime/use-airtime-play';
        import { useOtspPlay } from './lib/protocols/on-the-same-page/use-otsp-play';
        import { useCoverStoryPlay } from './lib/cover-story/use-cover-story-play';
        import { useWaoPairPlay } from './lib/wao/use-wao-pair-play';
        import { useSessionContext } from './components/providers/SessionProvider';
        import { SessionCompletedRedirect } from './components/session/session-completed-redirect';
        import { SessionLobbyView } from './components/session/session-lobby-view';
        const boot = JSON.parse(document.getElementById('bootstrap').textContent);
        const Probe = () => { const state = useGameState(); return <output data-testid="shared-state">{JSON.stringify(state)}</output>; };
        const useWaoProbe = id => { const ctx=useSessionContext(); const play=useWaoPairPlay(id,ctx.currentParticipant.id,{isLead:ctx.roleInSession==='lead'}); return {...play,state:play.state?{...play.state,phase:play.phase,displayMine:play.displayMine,selectionTheirs:play.selectionTheirs,reveal:play.reveal}:null,pending:play.unconfirmedItemIds.size>0,error:play.syncWarning??play.error,send:action=>play.sendTap(action.itemId)}; };
        const useDibeProbe = () => { const ctx=useSessionContext(),game=useGameState(); useDibeTimerRecovery(game.stateJson,ctx.sendAction,game.sessionStatus==='active'); return {state:game.stateJson?.version?game.stateJson:null,pending:false,error:game.connectionError,send:ctx.sendAction}; };
        const DibeScreen = ({sessionId}) => { const ctx=useSessionContext(),game=useGameState(),state=game.stateJson; if(!state?.version) return <p>Loading</p>; return <ScoringCriteriaForm key={state.phase+state.timer_started_at} sessionId={sessionId} participantId={ctx.currentParticipant.id} phase={state.phase} criteria={state.active_criteria} timerStartedAt={state.timer_started_at} timerDurationSeconds={state.timer_duration_seconds} existingAnswers={state.scoring_submissions?.[ctx.currentParticipant.id]} imageName={null} sendAction={async(...args)=>{await ctx.sendAction(...args);}}/>; };
        const hookMap = { 'draw-it-by-ear':useDibeProbe,'talk-track':useTalkTrackPlay,'zoning-rights':useZoningRightsPlay,ikwym:useIkwymPlay,'rank-and-file':useRankAndFilePlay,'the-truth-is':useTruthIsPlay,airtime:useAirtimePlay,'on-the-same-page':useOtspPlay,'cover-story':useCoverStoryPlay,wao:useWaoProbe };
        const HookProbe = () => { const play=hookMap[boot.slug](boot.session.id); React.useEffect(()=>{ window.__workshopSend=play.send; },[play.send]); return <output data-testid="hook-state">{JSON.stringify({state:play.state,error:play.error,pending:play.pending})}</output>; };
        const Lobby = () => <SessionLobbyView sessionId={boot.session.id} lifecycleVersion={boot.session.lifecycle_version}
          protocolName="Say Less" protocolSlug={boot.slug} minPlayers={4} joinCode={boot.session.join_code}
          joinUrl={location.origin+'/join/'+boot.session.join_code} initialParticipants={boot.participants}
          currentRole={boot.roleInSession} currentParticipantId={boot.currentParticipant.id}/>;
        const screens = {'draw-it-by-ear':DibeScreen,'the-truth-is':TruthIs,'rank-and-file':RankAndFile,ikwym:Ikwym};
        const Protocol = boot.screen ? screens[boot.slug] : boot.hook ? HookProbe : boot.lobby ? Lobby : boot.probe ? Probe : boot.slug === 'code-switch' ? CodeSwitch : SayLess;
        const Root = () => {
          const [sessionId, choose] = React.useState(boot.session.id);
          React.useEffect(() => { if (boot.probe) window.__probeSwitchSession = choose; }, []);
          return <SessionProvider {...boot} session={{...boot.session,id:sessionId}} protocolName={boot.slug}>{boot.navProbe && !boot.lobby ? <SessionCompletedRedirect sessionId={sessionId}/> : null}<Protocol sessionId={sessionId}/></SessionProvider>;
        };
        createRoot(document.getElementById('root')).render(<React.StrictMode><Root/></React.StrictMode>);`,
        resolveDir: appRoot, loader: 'jsx' },
      bundle: true, write: false, jsx: 'automatic', platform: 'browser',
      tsconfig: join(appRoot, 'tsconfig.json'),
      define: { 'process.env.NODE_ENV': '"development"',
        'process.env.NEXT_PUBLIC_GIPHY_API_KEY': '"local-test-placeholder"',
        'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(`${origin}/supabase`),
        'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': '"local-browser-test-key"' },
      plugins: [{ name: 'next-shell-only', setup(build) {
        build.onResolve({ filter: /^@\/app\/\(site\)\/session\/\[session_id\]\/lobby\/actions$/ }, () => ({ path: 'start-actions', namespace: 'browser-shell' }));
        build.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'browser-shell' }));
        build.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'browser-shell' }));
        build.onLoad({ filter: /.*/, namespace: 'browser-shell' }, ({ path }) => ({ resolveDir: appRoot, contents: path === 'link'
          ? `import React from 'react'; export default function Link({href,children,...props}) { return React.createElement('a',{...props,href},children); }`
          : path === 'start-actions'
          ? `export const startSessionAction = async (id,version) => {
              const response = await fetch('/__test/start/'+id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version})});
              if(!response.ok) throw new Error('Server action failed'); return response.json();
            }; export const transferLeadAction = async () => { throw new Error('Lead transfer is outside this harness'); };`
          : `const go = url => { const boot=JSON.parse(document.getElementById('bootstrap').textContent); if(boot.navProbe) window.__probeNavigation=url; else location.assign(url); }; const router={ replace:go,push:go,refresh:()=>{ const boot=JSON.parse(document.getElementById('bootstrap').textContent); if(boot.navProbe) window.__probeNavigation='refresh'; else location.reload(); } }; export const useRouter=()=>router;` }));
      } }],
    });
    javascript = result.outputFiles[0].text;
    css = (await postcss([tailwindcss(join(appRoot, 'tailwind.config.ts'))])
      .process(await readFile(join(appRoot, 'app/globals.css'), 'utf8'), { from: join(appRoot, 'app/globals.css') })).css;
  } catch (error) { server.closeAllConnections(); await new Promise((done) => server.close(done)); await cluster.close(); throw error; }
  const seed = async (slug, options = {}) => {
    if (!['code-switch','say-less'].includes(slug)) {
      const actualSlug = slug==='ikwym'?'i-know-what-you-meme':slug==='wao'?'wrong-answers-only':slug;
      if(slug==='draw-it-by-ear') await cluster.pool.query("INSERT INTO protocols(slug,name,type,min_players,max_players) VALUES('draw-it-by-ear','Draw It By Ear','realtime',5,20) ON CONFLICT(slug) DO NOTHING");
      const fixture = await seedWorkshop(cluster.pool,actualSlug,{headcount:actualSlug==='on-the-same-page'?8:actualSlug==='draw-it-by-ear'?5:4,status:'lobby',...options});
      if(slug==='cover-story') {
        const cover = await importApp('lib/cover-story/actions.ts');
        const configured=await cover.dispatchCoverStoryAction({admin:cluster.database,sessionId:fixture.sessionId,participantId:fixture.players[0],isLead:true,action:{type:'setRevealDate',revealOn:'2020-01-20'}});
        if(!configured.ok) throw new Error(configured.error);
      }
      try { const result=await withRequestDatabase(cluster.database,fixture.players[0],()=>lobbyActions.startSessionAction(fixture.sessionId,0)); if(result?.error) throw new Error(result.error); }
      catch(error) { if(!error.message.startsWith('NEXT_REDIRECT:')) throw error; }
      if(slug==='draw-it-by-ear') {
        const criteria=[{text:'Criterion one',points:1},{text:'Criterion two',points:1},{text:'Criterion three',points:1}];
        const response=await withRequestDatabase(cluster.database,fixture.players[0],()=>routes.get('dibe/action').POST(new Request('http://local.invalid/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({actionType:'initializeGame',payload:{participants:fixture.players.map((id,i)=>({id,display_name:`Player ${i}`})),imageCatalog:[{id:crypto.randomUUID(),name:'RoboDoc',criteria}],leadParticipantId:fixture.players[0]},generation:1})}),{params:{id:fixture.sessionId}}));
        if(!response.ok) throw new Error(await response.text());
        await cluster.pool.query("UPDATE session_state SET phase='ROUND_SCORING_1PT',state_json=state_json||$2::jsonb WHERE session_id=$1",[fixture.sessionId,JSON.stringify({phase:'ROUND_SCORING_1PT',active_criteria:criteria,timer_started_at:new Date().toISOString(),timer_duration_seconds:600})]);
      }
      if(slug==='wao') {
        const {rows:[count]}=await cluster.pool.query('SELECT count(*)::int n FROM wao_questions');
        if(!count.n) for(let index=0;index<5;index++) {
          const {rows:[q]}=await cluster.pool.query("INSERT INTO wao_questions(category_title,disambiguation_rule,correct_count,difficulty,region_tag,pinned) VALUES($1,'Local rule',5,1,'global',$2) RETURNING id",[`Local question ${index}`,index===0]);
          for(let i=0;i<10;i++) await cluster.pool.query("INSERT INTO wao_question_items(question_id,label,is_correct,trap_tier) VALUES($1,$2,$3,'gimme')",[q.id,`Item ${i}`,i>=5]);
        }
        const {startWaoRound}=await importApp('lib/wao/start-round.ts');
        const round=await startWaoRound({admin:cluster.database,sessionId:fixture.sessionId});
        if(!round.ok)throw new Error(round.error);fixture.roundId=round.round.id;
      }
      fixture.slug=slug; fixtures.set(fixture.sessionId,fixture);return fixture;
    }
    const fixture = slug === 'code-switch' ? await seedSwitchCode(cluster.pool, { clues: [], ...options }) : await seedSayLess(cluster.pool, options);
    fixture.slug = slug;
    fixtures.set(fixture.sessionId, fixture);
    if (slug === 'code-switch') await cluster.pool.query('UPDATE code_switch_rounds SET write_started_at=clock_timestamp() WHERE id=$1', [fixture.roundId]);
    else await cluster.pool.query(`INSERT INTO say_less_teams(session_id,label,member_ids) VALUES ($1,'B',$2)`, [fixture.sessionId, fixture.players.slice(2)]);
    return fixture;
  };
  return { origin, cluster, seed, requests,
    url: (fixture, index = 0) => `${origin}/workshop/${fixture.sessionId}?actor=${fixture.players[index]}`,
    async close() { server.closeAllConnections(); await new Promise((done) => server.close(done)); await cluster.close(); },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = await startBrowserServer();
  const fixture = await app.seed('code-switch');
  console.log(JSON.stringify({ origin: app.origin, url: app.url(fixture, 1) }));
  const stop = async () => { await app.close(); process.exit(0); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
}
