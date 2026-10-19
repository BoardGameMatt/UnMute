import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { OTSP } from "./config";
import { createGame, reduceFor, undrawnIds } from "./engine";
import type { Picture } from "./pictures";
import type { ActorAction, EngineEvent, OtspGame } from "./types";
import {
  completeSession,
  insertEvents,
  insertRound,
  insertSessionGame,
  loadCatalog,
  loadDebtIds,
  loadRoster,
  loadSessionMeta,
  loadStoredGame,
  loadUsedPictureIds,
  playersOf,
  resetOnTheSamePageRows,
  saveGame,
  syncPublicState,
  writeRotationDebt,
  type StoredGame,
} from "./store";
type ActionOk = { ok: true };
type ActionErr = { ok: false; status: number; error: string };
export type OtspActionResult = ActionOk | ActionErr;

function fail(status: number, error: string): ActionErr {
  return { ok: false, status, error };
}

function due(game: OtspGame, now: number): boolean {
  if (game.phase === "scoreboard") return false;
  if (game.phase === "reveal" && game.round.revealStep === "outcome") return false;
  if (game.phase === "build") return now >= game.round.phaseEndsAt + OTSP.graceMs;
  return now >= game.round.phaseEndsAt;
}

async function persist(
  admin: SupabaseClient,
  sessionId: string,
  version: number,
  game: OtspGame,
  events: EngineEvent[]
): Promise<boolean> {
  const saved = await saveGame(admin, sessionId, version, game);
  if (!saved) return false;
  await insertEvents(admin, sessionId, game.roundNumber, events);
  if (events.some((item) => item.type === "round_start")) await insertRound(admin, sessionId, game);
  await syncPublicState(admin, sessionId, game);
  return true;
}

export async function advanceIfDue(
  admin: SupabaseClient,
  sessionId: string,
  stored: StoredGame,
  catalog: readonly Picture[]
): Promise<StoredGame | null> {
  let game = stored.game;
  const events: EngineEvent[] = [];
  let steps = 0;
  while (steps < 40 && due(game, Date.now())) {
    const now = Date.now();
    const marker = `${game.phase}:${game.round.revealStep}:${game.round.cursor}:${game.round.phaseEndsAt}`;
    const result = reduceFor(game, { type: "expire", actorId: game.playerIds[0] ?? "" }, now, catalog);
    if (!result.ok) break;
    const nextMarker = `${result.game.phase}:${result.game.round.revealStep}:${result.game.round.cursor}:${result.game.round.phaseEndsAt}`;
    if (nextMarker === marker && result.events.length === 0) break;
    game = result.game;
    events.push(...result.events);
    steps += 1;
    if (game.phase === "reveal") break;
  }
  if (steps === 0) return stored;
  const saved = await persist(admin, sessionId, stored.version, game, events);
  if (!saved) return null;
  return { version: stored.version + 1, game };
}

export async function resetOnTheSamePageToLobby(admin: SupabaseClient, sessionId: string): Promise<void> {
  await resetOnTheSamePageRows(admin, sessionId);
}

export async function startOnTheSamePage(admin: SupabaseClient, sessionId: string): Promise<OtspActionResult> {
  const players = playersOf(await loadRoster(admin, sessionId));
  if (players.length < OTSP.minPlayers) return fail(400, "Need 8 to start.");
  if (players.length > OTSP.maxPlayers) return fail(400, "On the Same Page holds 16 players at most.");

  await resetOnTheSamePageRows(admin, sessionId);
  const meta = await loadSessionMeta(admin, sessionId);
  const catalog = await loadCatalog(admin, meta.contentPackId);
  if (catalog.length === 0) return fail(500, "Pack A is not installed for On the Same Page.");

  const created = createGame({
    seed: Math.floor(Math.random() * 1_000_000_000),
    playerIds: players.map((player) => player.participantId),
    debtIds: await loadDebtIds(admin, meta.teamId),
    usedPictureIds: await loadUsedPictureIds(admin, meta.teamId),
    catalog,
    now: Date.now(),
  });

  await insertSessionGame(admin, sessionId, created.game);
  await insertRound(admin, sessionId, created.game);
  await insertEvents(admin, sessionId, created.game.roundNumber, [
    {
      type: "session_start",
      actorId: null,
      role: null,
      payload: {
        headcount: players.length,
        playerList: players.map((player) => ({ id: player.participantId, name: player.displayName })),
      },
    },
    ...created.events,
  ]);
  await syncPublicState(admin, sessionId, created.game);
  return { ok: true };
}

const HOST_ACTIONS = new Set<ActorAction["type"]>(["anotherRound", "scoreboard", "expire"]);

export async function dispatchOtspAction(input: {
  admin: SupabaseClient;
  sessionId: string;
  participantId: string;
  canControl: boolean;
  isDisplay: boolean;
  action: ActorAction;
}): Promise<OtspActionResult> {
  const { admin, sessionId, canControl, isDisplay, action } = input;
  if ((action.type === "anotherRound" || action.type === "scoreboard") && !canControl) {
    return fail(403, "The shared screen runs the round.");
  }
  if (isDisplay && !HOST_ACTIONS.has(action.type)) {
    return fail(403, "Play on your phone.");
  }

  const stored = await loadStoredGame(admin, sessionId);
  if (!stored) return fail(404, "On the Same Page has not started.");
  const meta = await loadSessionMeta(admin, sessionId);
  const catalog = await loadCatalog(admin, meta.contentPackId);
  const current = await advanceIfDue(admin, sessionId, stored, catalog);
  if (!current) return fail(409, "The room moved. Try again.");

  const now = Date.now();
  if (action.type === "expire" && !due(current.game, now)) return { ok: true };

  const result = reduceFor(current.game, { ...action, actorId: input.participantId }, now, catalog);
  if (!result.ok) return fail(400, result.error);

  const saved = await persist(admin, sessionId, current.version, result.game, result.events);
  if (!saved) return fail(409, "The room moved. Try again.");

  if (action.type === "scoreboard") {
    await writeRotationDebt(admin, meta.teamId, result.game.drawnIds, undrawnIds(result.game));
  }
  return { ok: true };
}

export async function finishOnTheSamePage(input: {
  admin: SupabaseClient;
  sessionId: string;
  canControl: boolean;
}): Promise<OtspActionResult> {
  if (!input.canControl) return fail(403, "The shared screen ends the Moment.");
  const stored = await loadStoredGame(input.admin, input.sessionId);
  if (!stored) return fail(404, "On the Same Page has not started.");
  if (stored.game.phase !== "scoreboard") return fail(400, "Open the scores before ending.");
  const meta = await loadSessionMeta(input.admin, input.sessionId);
  await writeRotationDebt(input.admin, meta.teamId, stored.game.drawnIds, undrawnIds(stored.game));
  await insertEvents(input.admin, input.sessionId, stored.game.roundNumber, [
    { type: "host_action", actorId: null, role: null, payload: { action: "end" } },
  ]);
  await completeSession(input.admin, input.sessionId);
  return { ok: true };
}
