import {
  BRIDGE_LINE,
  OTSP,
  PIECE_COLORS,
  TILE_IDS,
  type PieceColor,
  type ReactionKind,
  type TileId,
  isTileId,
  turnMs,
} from "./config";
import { pictureById, type Family, type Picture } from "./pictures";
import type {
  ActorAction,
  EngineAction,
  EngineEvent,
  GuessBand,
  OtspGame,
  OtspPhase,
  OtspPlayState,
  Placement,
  RevealStep,
  Role,
  RoundState,
  ScoreBreakdown,
} from "./types";

export type ReduceResult = { ok: true; game: OtspGame; events: EngineEvent[] } | { ok: false; error: string };

const REVEAL_ORDER: RevealStep[] = ["suspicion", "improviser", "guess", "picture", "outcome"];

const OPEN_PHASES = new Set<OtspPhase>(["deal", "build", "checkin", "final_lock"]);

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const swap = next[i];
    next[i] = next[j] as T;
    next[j] = swap as T;
  }
  return next;
}

export function roundSeed(sessionSeed: number, roundNumber: number): number {
  return (Math.imul(sessionSeed ^ roundNumber, 0x9e3779b1) ^ (roundNumber * 0x85ebca6b)) >>> 0;
}

export function majorityReached(correct: number, inspectors: number): boolean {
  return inspectors > 0 && correct * 2 > inspectors;
}

export function drawPlacers(
  playerIds: readonly string[],
  drawnIds: readonly string[],
  debtIds: readonly string[],
  rng: () => number
): string[] {
  const drawn = new Set(drawnIds);
  const debt = new Set(debtIds);
  const undrawn = playerIds.filter((id) => !drawn.has(id));
  const debtFirst = shuffle(
    undrawn.filter((id) => debt.has(id)),
    rng
  );
  const otherUndrawn = shuffle(
    undrawn.filter((id) => !debt.has(id)),
    rng
  );
  const already = shuffle(
    playerIds.filter((id) => drawn.has(id)),
    rng
  );
  return [...debtFirst, ...otherUndrawn, ...already].slice(0, OTSP.placers);
}

export function pickImproviser(placers: readonly string[], history: readonly string[], rng: () => number): string {
  const past = new Set(history);
  const fresh = placers.filter((id) => !past.has(id));
  if (fresh.length > 0) return shuffle(fresh, rng)[0] as string;
  const order = new Map(history.map((id, index) => [id, index]));
  return [...placers].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))[0] as string;
}

/** Seeded shuffle. If the Improviser would take the first seat, rotate one seat. */
export function orderTurns(placers: readonly string[], improviserId: string, rng: () => number): string[] {
  const order = shuffle(placers, rng);
  if (order[0] === improviserId && order.length > 1) {
    const first = order.shift();
    if (first) order.push(first);
  }
  return order;
}

export function assignColors(placers: readonly string[], rng: () => number): Record<string, PieceColor> {
  const colors = shuffle([...PIECE_COLORS], rng);
  const assigned: Record<string, PieceColor> = {};
  placers.forEach((id, index) => {
    assigned[id] = colors[index] as PieceColor;
  });
  return assigned;
}

export function pickPicture(
  catalog: readonly Picture[],
  opts: { roundNumber: number; usedIds: readonly string[]; lastFamily: Family | null; rng: () => number }
): Picture {
  const used = new Set(opts.usedIds);
  const active = catalog.filter((picture) => picture.id);
  const filter = (starterOnly: boolean, unusedOnly: boolean, family: boolean): Picture[] =>
    active.filter((picture) => {
      if (starterOnly && !picture.starter) return false;
      if (unusedOnly && used.has(picture.id)) return false;
      if (family && opts.lastFamily && picture.family === opts.lastFamily) return false;
      return true;
    });

  let choices: Picture[] = [];
  if (opts.roundNumber === 1) {
    choices = filter(true, true, true);
    if (choices.length === 0) choices = filter(true, true, false);
    if (choices.length === 0) choices = filter(false, true, true);
    if (choices.length === 0) choices = filter(false, true, false);
  } else {
    choices = filter(false, true, true);
    if (choices.length === 0) choices = filter(false, true, false);
  }
  if (choices.length === 0) choices = filter(false, false, true);
  if (choices.length === 0) choices = filter(false, false, false);
  if (choices.length === 0) throw new Error("Picture library is empty.");
  return shuffle(choices, opts.rng)[0] as Picture;
}

export function bandFor(phase: OtspPhase, cursor: number): GuessBand {
  if (phase === "deal") return 1;
  if (phase === "checkin") return 2;
  if (phase === "final_lock" || phase === "reveal" || phase === "scoreboard") return 5;
  const lap = Math.floor(cursor / 5) + 1;
  if (lap <= 1) return 1;
  if (lap === 2) return 2;
  if (lap === 3) return 3;
  if (lap === 4) return 4;
  return 5;
}

export function displayLap(game: OtspGame): number {
  if (game.phase === "deal") return 1;
  if (game.phase === "checkin") return 2;
  if (game.phase === "build") return Math.floor(game.round.cursor / 5) + 1;
  const finished = Math.max(0, game.round.cursor - 1);
  return Math.min(5, Math.floor(finished / 5) + 1);
}

export function scoreRound(game: OtspGame): ScoreBreakdown {
  const round = game.round;
  const inspectors = game.playerIds.filter((id) => round.roles[id] === "inspector");
  const builders = game.playerIds.filter((id) => round.roles[id] === "builder");
  const improviserId = round.improviserId;
  const inspectorCorrect = inspectors.filter((id) => round.guesses[id]?.itemId === round.pictureId).length;
  const improviserGuess = round.guesses[improviserId];
  const improviserWrong = !improviserGuess || improviserGuess.itemId !== round.pictureId;
  const eligible = Math.max(0, game.playerIds.length - 1);
  const pinsOnImproviser = game.playerIds.filter((id) => round.pins[id] === improviserId).length;
  const points: Record<string, number> = {};
  for (const id of game.playerIds) points[id] = 0;

  for (const id of [...inspectors, improviserId]) {
    const guess = round.guesses[id];
    if (guess && guess.itemId === round.pictureId) points[id] = (points[id] ?? 0) + (6 - guess.band);
  }
  for (const id of [...builders, ...inspectors]) {
    if (round.pins[id] === improviserId) points[id] = (points[id] ?? 0) + 2;
  }
  if (majorityReached(inspectorCorrect, inspectors.length) && improviserWrong) {
    for (const id of builders) points[id] = (points[id] ?? 0) + 3;
  }
  if (pinsOnImproviser * 2 < eligible) points[improviserId] = (points[improviserId] ?? 0) + 3;

  return {
    points,
    readPicture: inspectors.length === 0 ? 0 : inspectorCorrect / inspectors.length,
    readPerson: eligible === 0 ? 0 : pinsOnImproviser / eligible,
    pinsOnImproviser,
    inspectorCorrect,
    inspectorCount: inspectors.length,
  };
}

export function createGame(input: {
  seed: number;
  playerIds: readonly string[];
  debtIds: readonly string[];
  usedPictureIds: readonly string[];
  catalog: readonly Picture[];
  now: number;
}): { game: OtspGame; events: EngineEvent[] } {
  if (input.playerIds.length < OTSP.minPlayers || input.playerIds.length > OTSP.maxPlayers) {
    throw new Error(`On the Same Page needs ${OTSP.minPlayers} to ${OTSP.maxPlayers} players.`);
  }
  const totals: Record<string, number> = {};
  for (const id of input.playerIds) totals[id] = 0;
  const base: OtspGame = {
    seed: input.seed >>> 0,
    playerIds: [...input.playerIds],
    drawnIds: [],
    improviserOrder: [],
    usedPictureIds: [...input.usedPictureIds],
    lastFamily: null,
    totals,
    roundNumber: 0,
    phase: "deal",
    round: emptyRound(),
    metrics: [],
  };
  return dealNext(base, input.debtIds, input.catalog, input.now);
}

export function reduce(game: OtspGame, action: EngineAction, now: number, catalog: readonly Picture[]): ReduceResult {
  const next = structuredClone(game);
  switch (action.type) {
    case "expire":
      return expire(next, now);
    case "preview":
      return preview(next, action.tile, action.row, action.col);
    case "place":
      return place(next, action.tile, action.row, action.col, now);
    case "guess":
    case "pin":
    case "react":
      return { ok: false, error: "Missing player." };
    case "anotherRound":
      return anotherRound(next, catalog, now);
    case "scoreboard":
      return openScoreboard(next);
    default:
      return { ok: false, error: "Unknown action." };
  }
}

function emptyRound(): RoundState {
  return {
    number: 0,
    seed: 0,
    pictureId: "",
    family: "round",
    guessIds: [],
    roles: {},
    placers: [],
    improviserId: "",
    colors: {},
    cursor: 0,
    placements: [],
    preview: null,
    guesses: {},
    pins: {},
    lastReactionAt: {},
    reactions: [],
    reactionSeq: 0,
    endAfterCheckin: false,
    endAfterTurn: false,
    endReason: null,
    phaseEndsAt: 0,
    phaseDurationMs: 0,
    revealStep: "suspicion",
    scored: false,
    totalsApplied: false,
    roundPoints: {},
    readPicture: 0,
    readPerson: 0,
  };
}

function dealNext(
  game: OtspGame,
  debtIds: readonly string[],
  catalog: readonly Picture[],
  now: number
): { game: OtspGame; events: EngineEvent[] } {
  const number = game.roundNumber + 1;
  const seed = roundSeed(game.seed, number);
  const rng = mulberry32(seed);
  const drawn = drawPlacers(game.playerIds, game.drawnIds, debtIds, rng);
  const improviserId = pickImproviser(drawn, game.improviserOrder, rng);
  const placers = orderTurns(drawn, improviserId, rng);
  const colors = assignColors(placers, rng);
  const picture = pickPicture(catalog, {
    roundNumber: number,
    usedIds: game.usedPictureIds,
    lastFamily: game.lastFamily,
    rng,
  });
  const familyPictures = catalog.filter((item) => item.family === picture.family);
  const guessIds = shuffle(familyPictures, rng).map((item) => item.id);
  const roles: Record<string, Role> = {};
  for (const id of game.playerIds) roles[id] = "inspector";
  for (const id of placers) roles[id] = id === improviserId ? "improviser" : "builder";

  const round: RoundState = {
    ...emptyRound(),
    number,
    seed,
    pictureId: picture.id,
    family: picture.family,
    guessIds,
    roles,
    placers,
    improviserId,
    colors,
    phaseEndsAt: now + turnMs(number),
    phaseDurationMs: turnMs(number),
  };

  const next: OtspGame = {
    ...game,
    roundNumber: number,
    phase: "build",
    round,
    drawnIds: Array.from(new Set([...game.drawnIds, ...placers])),
    improviserOrder: [...game.improviserOrder, improviserId],
    usedPictureIds: [...game.usedPictureIds, picture.id],
    lastFamily: picture.family,
  };

  return {
    game: next,
    events: [
      {
        type: "round_start",
        actorId: null,
        role: null,
        payload: {
          round: number,
          seed,
          picture: picture.id,
          family: picture.family,
          guessList: guessIds,
          roles,
          colors,
          turnOrder: placers,
        },
      },
    ],
  };
}

function actorRole(game: OtspGame, actorId: string | null): Role | null {
  if (!actorId) return null;
  return game.round.roles[actorId] ?? null;
}

function event(game: OtspGame, type: string, actorId: string | null, payload: Record<string, unknown>): EngineEvent {
  return { type, actorId, role: actorRole(game, actorId), payload };
}

function ok(game: OtspGame, events: EngineEvent[]): ReduceResult {
  return { ok: true, game, events };
}

function activeId(round: RoundState): string {
  return round.placers[round.cursor % OTSP.placers] ?? "";
}

function cellTaken(round: RoundState, row: number, col: number): boolean {
  return round.placements.some((placement) => !placement.passed && placement.row === row && placement.col === col);
}

function validCell(row: number, col: number): boolean {
  return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < 10 && col >= 0 && col < 10;
}

function lapOf(cursor: number): number {
  return Math.floor(cursor / 5) + 1;
}

function noteMajority(game: OtspGame): void {
  const round = game.round;
  if (round.endAfterTurn) return;
  const inspectors = game.playerIds.filter((id) => round.roles[id] === "inspector");
  const correct = inspectors.filter((id) => round.guesses[id]?.itemId === round.pictureId).length;
  if (!majorityReached(correct, inspectors.length)) return;
  round.endAfterTurn = true;
}

function enterFinalLock(game: OtspGame, reason: "early" | "lap5", now: number): EngineEvent[] {
  const events: EngineEvent[] = [];
  if (game.phase === "checkin") events.push(event(game, "checkin_end", null, { lap: 2 }));
  game.phase = "final_lock";
  game.round.endReason = reason;
  game.round.phaseEndsAt = now + OTSP.finalLockMs;
  game.round.phaseDurationMs = OTSP.finalLockMs;
  game.round.preview = null;
  return events;
}

function blanks(game: OtspGame): { pin: string[]; guess: string[] } {
  const pin = game.playerIds.filter((id) => game.round.pins[id] == null);
  const guess = game.playerIds.filter((id) => {
    const role = game.round.roles[id];
    return (role === "inspector" || role === "improviser") && !game.round.guesses[id];
  });
  return { pin, guess };
}

function enterReveal(game: OtspGame, now: number): EngineEvent[] {
  const scored = scoreRound(game);
  game.round.scored = true;
  game.round.roundPoints = scored.points;
  game.round.readPicture = scored.readPicture;
  game.round.readPerson = scored.readPerson;
  game.phase = "reveal";
  game.round.revealStep = "suspicion";
  game.round.phaseDurationMs = OTSP.revealMs.suspicion;
  game.round.phaseEndsAt = now + OTSP.revealMs.suspicion;
  game.round.preview = null;
  return [
    event(game, "round_end", null, {
      reason: game.round.endReason ?? "lap5",
      lap: displayLap(game),
      turn: game.round.cursor,
      pins: game.round.pins,
      guesses: game.round.guesses,
      points: scored.points,
      blanks: blanks(game),
      readPicture: scored.readPicture,
      readPerson: scored.readPerson,
      pinsOnImproviser: scored.pinsOnImproviser,
      inspectorCorrect: scored.inspectorCorrect,
    }),
  ];
}

function applyTotals(game: OtspGame): void {
  if (game.round.totalsApplied) return;
  game.round.totalsApplied = true;
  for (const id of game.playerIds) {
    game.totals[id] = (game.totals[id] ?? 0) + (game.round.roundPoints[id] ?? 0);
  }
  game.metrics.push({
    round: game.roundNumber,
    readPicture: game.round.readPicture,
    readPerson: game.round.readPerson,
  });
}

function finishTurn(game: OtspGame, placement: Placement, now: number, prior: EngineEvent[]): ReduceResult {
  game.round.placements.push(placement);
  game.round.preview = null;
  const nextCursor = game.round.cursor + 1;
  game.round.cursor = nextCursor;
  if (game.round.endAfterTurn) {
    game.round.endReason = "early";
    return ok(game, [...prior, ...enterReveal(game, now)]);
  }
  if (nextCursor >= 25) {
    game.round.endReason = "lap5";
    return ok(game, [...prior, ...enterReveal(game, now)]);
  }
  game.phase = "build";
  game.round.phaseDurationMs = turnMs(game.roundNumber);
  game.round.phaseEndsAt = now + game.round.phaseDurationMs;
  return ok(game, prior);
}

function placedTile(participantId: string, tile: TileId, row: number, col: number, cursor: number): Placement {
  return { passed: false, participantId, tile, row, col, lap: lapOf(cursor), turn: cursor };
}

function forcedTile(round: RoundState): { tile: TileId; row: number; col: number } {
  const rng = mulberry32((round.seed ^ (round.cursor + 1)) >>> 0);
  const free: { row: number; col: number }[] = [];
  for (let row = 0; row < 10; row += 1) {
    for (let col = 0; col < 10; col += 1) {
      if (!cellTaken(round, row, col)) free.push({ row, col });
    }
  }
  const cell = free[Math.floor(rng() * free.length)] ?? { row: 0, col: 0 };
  const tile = TILE_IDS[Math.floor(rng() * TILE_IDS.length)] ?? "square";
  return { tile, ...cell };
}

function expire(game: OtspGame, now: number): ReduceResult {
  const round = game.round;
  if (game.phase === "scoreboard") return ok(game, []);
  if (game.phase === "reveal" && round.revealStep === "outcome") return ok(game, []);

  if (game.phase === "build") {
    if (now < round.phaseEndsAt + OTSP.graceMs) return ok(game, []);
    const actor = activeId(round);
    const preview = round.preview;
    if (
      preview &&
      isTileId(preview.tile) &&
      validCell(preview.row, preview.col) &&
      !cellTaken(round, preview.row, preview.col)
    ) {
      return finishTurn(
        game,
        placedTile(actor, preview.tile, preview.row, preview.col, round.cursor),
        now,
        [event(game, "place", actor, { tile: preview.tile, row: preview.row, col: preview.col, lap: lapOf(round.cursor), turn: round.cursor, timeout: true })]
      );
    }
    const forced = forcedTile(round);
    return finishTurn(game, placedTile(actor, forced.tile, forced.row, forced.col, round.cursor), now, [
      event(game, "place", actor, { tile: forced.tile, row: forced.row, col: forced.col, lap: lapOf(round.cursor), turn: round.cursor, timeout: true }),
    ]);
  }

  if (now < round.phaseEndsAt) return ok(game, []);

  if (game.phase === "deal") {
    game.phase = "build";
    game.round.cursor = 0;
    game.round.phaseDurationMs = turnMs(game.roundNumber);
    game.round.phaseEndsAt = now + game.round.phaseDurationMs;
    return ok(game, []);
  }

  if (game.phase === "checkin") {
    if (round.endAfterCheckin) return ok(game, enterFinalLock(game, "early", now));
    game.phase = "build";
    game.round.phaseDurationMs = turnMs(game.roundNumber);
    game.round.phaseEndsAt = now + game.round.phaseDurationMs;
    return ok(game, [event(game, "checkin_end", null, { lap: 2 })]);
  }

  if (game.phase === "final_lock") return ok(game, enterReveal(game, now));

  if (game.phase === "reveal") {
    const index = REVEAL_ORDER.indexOf(round.revealStep);
    const nextStep = REVEAL_ORDER[index + 1];
    if (!nextStep) return ok(game, []);
    round.revealStep = nextStep;
    const duration = OTSP.revealMs[nextStep];
    round.phaseDurationMs = duration;
    round.phaseEndsAt = duration === 0 ? now : now + duration;
    if (nextStep === "outcome") applyTotals(game);
    return ok(game, []);
  }

  return ok(game, []);
}

function preview(game: OtspGame, tile: TileId, row: number, col: number): ReduceResult {
  if (game.phase !== "build") return { ok: false, error: "You can only set up a tile on your turn." };
  if (!isTileId(tile) || !validCell(row, col)) return { ok: false, error: "That square is off the board." };
  if (cellTaken(game.round, row, col)) return { ok: false, error: "That square is taken." };
  game.round.preview = { tile, row, col };
  return ok(game, []);
}

function place(game: OtspGame, tile: TileId, row: number, col: number, now: number): ReduceResult {
  if (game.phase !== "build") return { ok: false, error: "It isn't a building turn." };
  if (now > game.round.phaseEndsAt + OTSP.graceMs) return { ok: false, error: "That turn already passed." };
  if (!isTileId(tile) || !validCell(row, col)) return { ok: false, error: "Choose a tile and an empty square." };
  if (cellTaken(game.round, row, col)) return { ok: false, error: "That square is taken." };
  const actor = activeId(game.round);
  const cursor = game.round.cursor;
  return finishTurn(game, placedTile(actor, tile, row, col, cursor), now, [
    event(game, "place", actor, { tile, row, col, lap: lapOf(cursor), turn: cursor, timeout: false }),
  ]);
}

function anotherRound(game: OtspGame, catalog: readonly Picture[], now: number): ReduceResult {
  if (game.phase !== "reveal" || game.round.revealStep !== "outcome") {
    return { ok: false, error: "Finish the reveal before the next round." };
  }
  const dealt = dealNext(game, [], catalog, now);
  return ok(dealt.game, [event(game, "host_action", null, { action: "another_round" }), ...dealt.events]);
}

function openScoreboard(game: OtspGame): ReduceResult {
  if (game.phase !== "reveal" || game.round.revealStep !== "outcome") {
    return { ok: false, error: "Finish the reveal before the reflection." };
  }
  if (!game.round.totalsApplied) applyTotals(game);
  game.phase = "scoreboard";
  return ok(game, [event(game, "host_action", null, { action: "reflection_questions" })]);
}

export function reduceFor(game: OtspGame, action: ActorAction, now: number, catalog: readonly Picture[]): ReduceResult {
  if (action.type === "guess") return guessFor(game, action.actorId, action.itemId);
  if (action.type === "pin") return pinFor(game, action.actorId, action.targetId);
  if (action.type === "react") return reactFor(game, action.actorId, action.kind, action.tileKey, now);
  if (action.type === "preview" || action.type === "place") {
    if (game.phase === "build" && action.actorId !== activeId(game.round)) {
      return { ok: false, error: "Wait for your turn." };
    }
  }
  return reduce(game, action, now, catalog);
}

function guessFor(game: OtspGame, actorId: string, itemId: string): ReduceResult {
  const next = structuredClone(game);
  if (!OPEN_PHASES.has(next.phase)) return { ok: false, error: "Guesses are closed." };
  const role = next.round.roles[actorId];
  if (role !== "inspector" && role !== "improviser") return { ok: false, error: "Builders already know the picture." };
  if (!next.round.guessIds.includes(itemId)) return { ok: false, error: "That isn't one of this round's pictures." };
  if (next.round.guesses[actorId]?.itemId === itemId) return ok(next, []);
  const band = bandFor(next.phase, next.round.cursor);
  next.round.guesses[actorId] = { itemId, band };
  noteMajority(next);
  return ok(next, [
    event(next, "guess_lock", actorId, { item: itemId, lap: displayLap(next), turn: next.round.cursor, band }),
  ]);
}

function pinFor(game: OtspGame, actorId: string, targetId: string | null): ReduceResult {
  const next = structuredClone(game);
  if (!OPEN_PHASES.has(next.phase)) return { ok: false, error: "Pins are closed." };
  if (targetId !== null && !next.round.placers.includes(targetId)) {
    return { ok: false, error: "Pin one of the five people placing tiles." };
  }
  const role = next.round.roles[actorId];
  if (role !== "inspector" && role !== "builder") return { ok: false, error: "The Improviser already knows." };
  if (targetId === actorId) return { ok: false, error: "Pin someone else." };
  next.round.pins[actorId] = targetId;
  return ok(next, [event(next, "pin_move", actorId, { target: targetId })]);
}

function reactFor(game: OtspGame, actorId: string, kind: ReactionKind, tileKey: string | null, now: number): ReduceResult {
  const next = structuredClone(game);
  if (!OPEN_PHASES.has(next.phase)) return { ok: false, error: "Reactions are closed." };
  const previous = next.round.lastReactionAt[actorId] ?? 0;
  if (now - previous < OTSP.reactionGapMs) return { ok: false, error: "Give it a second." };
  next.round.lastReactionAt[actorId] = now;
  next.round.reactionSeq += 1;
  next.round.reactions = [...next.round.reactions, { id: `r${next.round.reactionSeq}`, kind, at: now }].slice(-20);
  return ok(next, [event(next, "react", actorId, { reaction: kind, targetTile: tileKey })]);
}

const REVEAL_RANK: Record<RevealStep, number> = {
  suspicion: 0,
  improviser: 1,
  guess: 2,
  picture: 3,
  outcome: 4,
};

function revealAtLeast(game: OtspGame, step: RevealStep): boolean {
  if (game.phase === "scoreboard") return true;
  if (game.phase !== "reveal") return false;
  return REVEAL_RANK[game.round.revealStep] >= REVEAL_RANK[step];
}

export function projectPlayState(
  game: OtspGame,
  viewer: { participantId: string; isDisplay: boolean; canControl: boolean },
  names: Record<string, string>,
  catalog: readonly Picture[]
): OtspPlayState {
  const round = game.round;
  const myRole = viewer.isDisplay ? null : (round.roles[viewer.participantId] ?? null);
  const lap = displayLap(game);
  const showPicture =
    myRole === "builder" || revealAtLeast(game, "picture");
  const picture = pictureById(catalog, round.pictureId);
  const showImproviser = revealAtLeast(game, "improviser");
  const showGuess = revealAtLeast(game, "guess");
  const showOutcome = revealAtLeast(game, "outcome");
  const passedIds = new Set(
    round.placements.filter((placement) => placement.passed && placement.lap === lap).map((placement) => placement.participantId)
  );
  const active = game.phase === "build" ? activeId(round) : "";

  const suspicion = revealAtLeast(game, "suspicion")
    ? round.placers.map((id) => ({
        id,
        name: names[id] ?? "Player",
        count: game.playerIds.filter((playerId) => round.pins[playerId] === id).length,
      }))
    : [];

  const improviserGuess = round.guesses[round.improviserId];
  const totals = game.playerIds
    .map((id) => ({
      id,
      name: names[id] ?? "Player",
      roundPoints: showOutcome ? (round.roundPoints[id] ?? 0) : 0,
      total: game.totals[id] ?? 0,
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  const header = headerCopy(game, myRole, showPicture ? (picture?.label ?? null) : null);

  return {
    phase: game.phase,
    roundNumber: game.roundNumber,
    lap,
    phaseEndsAt: round.phaseEndsAt,
    phaseDurationMs: round.phaseDurationMs,
    placers: round.placers.map((id) => ({
      id,
      name: names[id] ?? "Player",
      color: viewer.isDisplay ? null : (round.colors[id] ?? null),
      passed: passedIds.has(id),
      active: id === active,
    })),
    placements: round.placements
      .filter((placement): placement is Extract<Placement, { passed: false }> => !placement.passed)
      .map((placement) => ({
        row: placement.row,
        col: placement.col,
        tile: placement.tile,
        participantId: placement.participantId,
        color: viewer.isDisplay ? null : (round.colors[placement.participantId] ?? null),
      })),
    preview:
      !viewer.isDisplay && viewer.participantId === active && game.phase === "build" ? round.preview : null,
    guessList:
      myRole === "inspector" || myRole === "improviser"
        ? round.guessIds.map((id) => ({ id, label: pictureById(catalog, id)?.label ?? id }))
        : [],
    myRole,
    selfId: viewer.isDisplay ? null : viewer.participantId,
    pictureLabel: showPicture ? (picture?.label ?? null) : null,
    headerTitle: header.title,
    headerBody: header.body,
    lockCount: game.playerIds.filter((id) => round.roles[id] === "inspector" && round.guesses[id]).length,
    inspectorCount: game.playerIds.filter((id) => round.roles[id] === "inspector").length,
    myGuessId: viewer.isDisplay ? null : (round.guesses[viewer.participantId]?.itemId ?? null),
    myPinId: viewer.isDisplay ? null : (round.pins[viewer.participantId] ?? null),
    canGuess:
      !viewer.isDisplay &&
      (myRole === "inspector" || myRole === "improviser") &&
      OPEN_PHASES.has(game.phase),
    canPin:
      !viewer.isDisplay && (myRole === "inspector" || myRole === "builder") && OPEN_PHASES.has(game.phase),
    canReact: !viewer.isDisplay && OPEN_PHASES.has(game.phase),
    isMyTurn: !viewer.isDisplay && game.phase === "build" && viewer.participantId === active,
    reactions: round.reactions,
    revealStep: round.revealStep,
    suspicion,
    improviserId: showImproviser ? round.improviserId : null,
    improviserName: showImproviser ? (names[round.improviserId] ?? "Player") : null,
    improviserGuessLabel: showGuess
      ? improviserGuess
        ? (pictureById(catalog, improviserGuess.itemId)?.label ?? "A guess")
        : "No guess"
      : null,
    readPicture: showOutcome ? round.readPicture : null,
    readPerson: showOutcome ? round.readPerson : null,
    totals,
    showTotals: viewer.isDisplay || showOutcome || game.phase === "scoreboard",
    canControl: viewer.canControl,
    bridge: BRIDGE_LINE,
    monochrome: viewer.isDisplay,
  };
}

function headerCopy(game: OtspGame, role: Role | null, pictureLabel: string | null): { title: string; body: string } {
  if (role === null) {
    if (game.phase === "deal") return { title: "Roles are on your phones", body: "If you know the picture, don't say it." };
    if (game.phase === "checkin") return { title: "Check-in", body: "One question. One sentence. Don't name the picture." };
    if (game.phase === "final_lock") return { title: "Final lock", body: "Last chance to lock a guess and a pin." };
    if (game.phase === "reveal") return { title: "Reveal", body: "Watch the board. Scores land at the end." };
    if (game.phase === "scoreboard") return { title: "Session scores", body: BRIDGE_LINE };
    return { title: `Lap ${displayLap(game)}`, body: "Tile, square, Place." };
  }
  if (game.phase === "deal") {
    if (role === "builder") {
      return {
        title: "You're a Builder",
        body: `The picture is ${pictureLabel ?? "the picture"}. Build it so the Inspectors can name it, but the Improviser can't.`,
      };
    }
    if (role === "improviser") {
      return {
        title: "You're the Improviser",
        body: "You don't know the picture. Your guess list is on screen. Keep up with the Builders and work out what it is.",
      };
    }
    return {
      title: "You're an Inspector",
      body: "Your guess list is on screen. Work out what's being built, and who's improvising.",
    };
  }
  if (role === "builder") {
    return {
      title: `Picture: ${pictureLabel ?? "Hidden"}`,
      body: "Build it so Inspectors can name it, and the Improviser can't.",
    };
  }
  if (role === "improviser") {
    return { title: "You're improvising", body: "Place tiles that fit, and work out the picture." };
  }
  return { title: "You're an Inspector", body: "Name the picture, and pin who's improvising." };
}

export function undrawnIds(game: OtspGame): string[] {
  const drawn = new Set(game.drawnIds);
  return game.playerIds.filter((id) => !drawn.has(id));
}

export function displayStorageKey(sessionId: string): string {
  return `otsp-display:${sessionId}`;
}
