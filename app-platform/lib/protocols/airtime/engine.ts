import { AIRTIME_CONFIG, TREASURE_DECK, cardById, type AirtimeConfig } from "./config";
import type {
  AirtimeEvent,
  BoatDiveState,
  Choice,
  DiveEndReason,
  DiveState,
  DiverState,
  GaugeBand,
  TurnResult,
} from "./types";

export function displayStorageKey(sessionId: string): string {
  return `unmute.airtime.display.${sessionId}`;
}

export function shuffleCopy<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = arr[i];
    const b = arr[j];
    if (a === undefined || b === undefined) continue;
    arr[i] = b;
    arr[j] = a;
  }
  return arr;
}

export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), h | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Boats

export function boatCountFor(players: number): number {
  if (players <= 3) return 1;
  if (players <= 8) return 2;
  if (players <= 12) return 3;
  return 4;
}

/** Random, balanced boats. Sizes differ by at most 1 and never exceed maxBoatSize. */
export function assignBoats(
  playerIds: readonly string[],
  random: () => number = Math.random
): string[][] {
  const count = boatCountFor(playerIds.length);
  const boats: string[][] = Array.from({ length: count }, () => []);
  shuffleCopy(playerIds, random).forEach((id, i) => {
    boats[i % count]?.push(id);
  });
  return boats;
}

export function hasRival(playerBoatCount: number): boolean {
  return playerBoatCount === 1;
}

export function tankFor(boatSize: number, config: AirtimeConfig = AIRTIME_CONFIG): number {
  return config.airPerDiver * boatSize + config.airBase;
}

export function rivalDiveScore(random: () => number = Math.random, config: AirtimeConfig = AIRTIME_CONFIG): number {
  const span = config.rivalScoreMax - config.rivalScoreMin + 1;
  return config.rivalScoreMin + Math.min(span - 1, Math.floor(random() * span));
}

// ---------------------------------------------------------------------------
// Air

export function airAtDepth(depth: number, config: AirtimeConfig = AIRTIME_CONFIG): number {
  if (depth < 1) return 0;
  return config.airByDepth[Math.min(depth, config.maxDepth) - 1] ?? 0;
}

/** Air a diver at `depth` uses if they swim back up every turn from now. */
export function airToSurface(depth: number, config: AirtimeConfig = AIRTIME_CONFIG): number {
  let total = 0;
  for (let level = 1; level < depth; level++) total += airAtDepth(level, config);
  return total;
}

/** Air for a round trip from level 1 down to `deepest` and back. */
export function roundTripAir(deepest: number, config: AirtimeConfig = AIRTIME_CONFIG): number {
  let down = 0;
  for (let level = 2; level <= deepest; level++) down += airAtDepth(level, config);
  return down + airToSurface(deepest, config);
}

export function airNeededNow(
  divers: readonly Pick<DiverState, "depth" | "status">[],
  config: AirtimeConfig = AIRTIME_CONFIG
): number {
  return divers
    .filter((d) => d.status === "underwater")
    .reduce((sum, d) => sum + airToSurface(d.depth, config), 0);
}

export function marginFor(
  tank: number,
  divers: readonly Pick<DiverState, "depth" | "status">[],
  config: AirtimeConfig = AIRTIME_CONFIG
): number {
  return tank - airNeededNow(divers, config);
}

export function gaugeBand(
  tank: number,
  tankStart: number,
  config: AirtimeConfig = AIRTIME_CONFIG
): GaugeBand {
  if (tankStart <= 0) return "critical";
  const pct = (tank / tankStart) * 100;
  if (pct > config.gaugeBands.plenty) return "plenty";
  if (pct >= config.gaugeBands.half) return "half";
  if (pct >= config.gaugeBands.low) return "low";
  return "critical";
}

export function gaugeSegments(band: GaugeBand): number {
  if (band === "plenty") return 4;
  if (band === "half") return 3;
  if (band === "low") return 2;
  return 1;
}

export const GAUGE_LABEL: Record<GaugeBand, string> = {
  plenty: "Plenty",
  half: "Good",
  low: "Low",
  critical: "Critical",
};

// ---------------------------------------------------------------------------
// Decks

export function shuffledBoatDecks(random: () => number = Math.random): Record<string, string[]> {
  const decks: Record<string, string[]> = {};
  for (let level = 1; level <= AIRTIME_CONFIG.maxDepth; level++) {
    decks[String(level)] = shuffleCopy(
      TREASURE_DECK.filter((c) => c.level === level).map((c) => c.id),
      random
    );
  }
  return decks;
}

function drawCard(decks: Record<string, string[]>, level: number): string {
  const key = String(level);
  const deck = decks[key] ?? [];
  const next = deck.shift();
  decks[key] = deck;
  if (next) return next;
  // Unreachable with ≤4 divers per boat and ≥5 cards per level.
  const fallback = TREASURE_DECK.find((c) => c.level === level);
  return fallback?.id ?? "";
}

export function cardValue(itemId: string): number {
  return cardById(itemId)?.value ?? 0;
}

// ---------------------------------------------------------------------------
// Dives

export type BoatRoster = { boatId: string; memberIds: string[] };

export function newDive(
  boats: readonly BoatRoster[],
  random: () => number = Math.random,
  config: AirtimeConfig = AIRTIME_CONFIG
): DiveState {
  const boatStates: BoatDiveState[] = [];
  const divers: DiverState[] = [];
  for (const boat of boats) {
    const decks = shuffledBoatDecks(random);
    const tankStart = tankFor(boat.memberIds.length, config);
    for (const participantId of boat.memberIds) {
      divers.push({
        participantId,
        boatId: boat.boatId,
        depth: 1,
        deepest: 1,
        itemId: drawCard(decks, 1),
        path: [],
        status: "underwater",
        surfacedTurn: null,
        haul: 0,
      });
    }
    boatStates.push({ boatId: boat.boatId, tankStart, tank: tankStart, tankByTurn: [], decks });
  }
  return { turn: 0, boats: boatStates, divers };
}

export function underwaterDivers(state: DiveState): DiverState[] {
  return state.divers.filter((d) => d.status === "underwater");
}

export function boatIsBack(state: DiveState, boatId: string): boolean {
  return !state.divers.some((d) => d.boatId === boatId && d.status === "underwater");
}

export function canChoose(diver: Pick<DiverState, "status" | "depth">, choice: Choice): boolean {
  if (diver.status !== "underwater") return false;
  if (choice === "deeper" && diver.depth >= AIRTIME_CONFIG.maxDepth) return false;
  return true;
}

export function allUnderwaterHaveChosen(
  state: DiveState,
  choices: Readonly<Record<string, Choice>>
): boolean {
  return underwaterDivers(state).every((d) => choices[d.participantId] !== undefined);
}

function cloneDive(state: DiveState): DiveState {
  return {
    turn: state.turn,
    boats: state.boats.map((b) => ({
      ...b,
      tankByTurn: [...b.tankByTurn],
      decks: Object.fromEntries(Object.entries(b.decks).map(([k, v]) => [k, [...v]])),
    })),
    divers: state.divers.map((d) => ({ ...d, path: [...d.path] })),
  };
}

/**
 * Resolve one turn (spec §5.2 steps 3–8). `choices` holds committed choices;
 * any underwater diver without one swims back up.
 */
export function resolveTurn(
  input: DiveState,
  choices: Readonly<Record<string, Choice>>,
  options: { endAfterThisTurn?: boolean; config?: AirtimeConfig } = {}
): TurnResult {
  const config = options.config ?? AIRTIME_CONFIG;
  const state = cloneDive(input);
  const turn = state.turn + 1;
  state.turn = turn;
  const events: AirtimeEvent[] = [];

  const boatById = new Map(state.boats.map((b) => [b.boatId, b]));
  const activeBoats = new Set(underwaterDivers(state).map((d) => d.boatId));

  const marginAtStart = new Map<string, number>();
  const crewAtStart = new Map<string, boolean>();
  for (const boat of state.boats) {
    const mine = state.divers.filter((d) => d.boatId === boat.boatId);
    marginAtStart.set(boat.boatId, marginFor(boat.tank, mine, config));
    crewAtStart.set(boat.boatId, mine.some((d) => d.status === "surfaced"));
  }

  const moved = underwaterDivers(state);

  // Steps 3–4: moves apply at once; new deepest level draws a card.
  for (const diver of moved) {
    const committed = choices[diver.participantId];
    const timedOut = committed === undefined;
    let choice: Choice = committed ?? config.timeoutChoice;
    if (choice === "deeper" && diver.depth >= config.maxDepth) choice = "up";
    const before = diver.depth;
    diver.depth = choice === "deeper" ? before + 1 : before - 1;
    events.push({
      type: "choice",
      turn,
      payload: {
        participant_id: diver.participantId,
        boat_id: diver.boatId,
        choice,
        timed_out: timedOut,
        depth_before: before,
        depth_after: diver.depth,
        margin_at_choice: marginAtStart.get(diver.boatId) ?? 0,
        crew_present: crewAtStart.get(diver.boatId) ?? false,
      },
    });
    if (diver.depth > diver.deepest) {
      diver.deepest = diver.depth;
      const boat = boatById.get(diver.boatId);
      if (boat) diver.itemId = drawCard(boat.decks, diver.depth);
    }
  }

  // Step 5: surfacing banks before air drains.
  for (const diver of underwaterDivers(state)) {
    if (diver.depth > 0) continue;
    diver.depth = 0;
    diver.status = "surfaced";
    diver.surfacedTurn = turn;
    diver.haul = cardValue(diver.itemId);
    events.push({
      type: "surfaced",
      turn,
      payload: { participant_id: diver.participantId, boat_id: diver.boatId, haul: diver.haul },
    });
  }

  // Steps 6–7: air drain, then out of air only below zero.
  for (const boat of state.boats) {
    if (!activeBoats.has(boat.boatId)) continue;
    const below = state.divers.filter((d) => d.boatId === boat.boatId && d.status === "underwater");
    const amount = below.reduce((sum, d) => sum + airAtDepth(d.depth, config), 0);
    boat.tank -= amount;
    if (boat.tank < 0) {
      boat.tank = 0;
      const lostHauls = below.map((d) => cardValue(d.itemId));
      for (const d of below) {
        d.status = "lost";
        d.haul = 0;
      }
      events.push({
        type: "air_drain",
        turn,
        payload: {
          boat_id: boat.boatId,
          amount,
          tank_after: 0,
          air_needed_now: 0,
          margin: 0,
        },
      });
      events.push({
        type: "out_of_air",
        turn,
        payload: {
          boat_id: boat.boatId,
          lost_participant_ids: below.map((d) => d.participantId),
          lost_hauls: lostHauls,
        },
      });
    } else {
      const needed = airNeededNow(below, config);
      events.push({
        type: "air_drain",
        turn,
        payload: {
          boat_id: boat.boatId,
          amount,
          tank_after: boat.tank,
          air_needed_now: needed,
          margin: boat.tank - needed,
        },
      });
    }
  }

  for (const boat of state.boats) boat.tankByTurn.push(boat.tank);
  for (const diver of moved) diver.path.push(diver.depth);

  // Step 8: dive end check.
  let endReason: DiveEndReason | null = null;
  if (underwaterDivers(state).length === 0) endReason = "all_back";
  else if (turn >= config.maxTurnsPerDive) endReason = "max_turns";
  else if (options.endAfterThisTurn) endReason = "facilitator";

  if (endReason && endReason !== "all_back") {
    const byBoat = new Map<string, string[]>();
    for (const d of underwaterDivers(state)) {
      d.status = "forfeit";
      d.haul = 0;
      byBoat.set(d.boatId, [...(byBoat.get(d.boatId) ?? []), d.participantId]);
    }
    for (const [boatId, ids] of Array.from(byBoat.entries())) {
      events.push({ type: "forfeit", turn, payload: { boat_id: boatId, participant_ids: ids } });
    }
  }
  if (endReason) events.push({ type: "dive_end", turn, payload: { end_reason: endReason } });

  return { state, events, ended: endReason !== null, endReason };
}

// ---------------------------------------------------------------------------
// Scoring

export function boatDiveTotal(state: DiveState, boatId: string): number {
  return state.divers
    .filter((d) => d.boatId === boatId && d.status === "surfaced")
    .reduce((sum, d) => sum + d.haul, 0);
}

export type BoatStanding = {
  boatId: string;
  diveTotals: number[];
  total: number;
};

/** Sum scoring. Returns standings sorted high to low and the winning boat ids (ties shared). */
export function rankBoats(standings: readonly BoatStanding[]): {
  ranked: BoatStanding[];
  winnerIds: string[];
} {
  const ranked = [...standings].sort((a, b) => b.total - a.total);
  const top = ranked[0]?.total;
  const winnerIds =
    top === undefined ? [] : ranked.filter((s) => s.total === top).map((s) => s.boatId);
  return { ranked, winnerIds };
}

export function timerHasExpired(endsAtIso: string | null, nowMs: number): boolean {
  if (!endsAtIso) return false;
  const end = new Date(endsAtIso).getTime();
  if (Number.isNaN(end)) return false;
  return nowMs >= end;
}

/**
 * A turn whose clock ran out resolves only after the grace period, so a tap
 * made before zero on a slow phone still lands. Early close is unaffected.
 */
export function turnGraceHasExpired(
  turnEndsAtIso: string | null,
  nowMs: number,
  config: AirtimeConfig = AIRTIME_CONFIG
): boolean {
  if (!turnEndsAtIso) return false;
  const end = new Date(turnEndsAtIso).getTime();
  if (Number.isNaN(end)) return false;
  return nowMs >= end + config.lateChoiceGraceSeconds * 1000;
}

export function progressRatio(completedUnits: number, config: AirtimeConfig = AIRTIME_CONFIG): number {
  if (completedUnits <= 0) return 0;
  return Math.min(1, completedUnits / config.progressUnits);
}
