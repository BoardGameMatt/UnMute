import type { StoredAirtimeEvent } from "./types";

export const ENABLER_MAX_HAUL = 2;

type EventOf<T extends StoredAirtimeEvent["type"]> = Extract<StoredAirtimeEvent, { type: T }>;

function ofType<T extends StoredAirtimeEvent["type"]>(
  events: readonly StoredAirtimeEvent[],
  type: T,
  dive: number
): EventOf<T>[] {
  return events.filter((e): e is EventOf<T> => e.type === type && e.dive === dive);
}

export function divesPlayed(events: readonly StoredAirtimeEvent[]): number[] {
  return Array.from(new Set(events.filter((e) => e.type === "dive_end").map((e) => e.dive))).sort(
    (a, b) => a - b
  );
}

/** Per boat: the turn the first diver surfaced, or null if nobody did. */
export function firstSurfaceTurns(
  events: readonly StoredAirtimeEvent[],
  dive: number
): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of ofType(events, "surfaced", dive)) {
    const prev = out.get(e.payload.boat_id);
    if (prev === undefined || e.turn < prev) out.set(e.payload.boat_id, e.turn);
  }
  return out;
}

/** Turns where a boat had divers underwater and no surfaced crew. */
export function blindTurns(events: readonly StoredAirtimeEvent[], dive: number): number {
  const keys = new Set<string>();
  for (const e of ofType(events, "choice", dive)) {
    if (!e.payload.crew_present) keys.add(`${e.turn}:${e.payload.boat_id}`);
  }
  return keys.size;
}

/** Dive Deeper choices made while the boat's margin was negative. */
export function dangerChoices(
  events: readonly StoredAirtimeEvent[],
  dive: number
): { total: number; withCrew: number } {
  let total = 0;
  let withCrew = 0;
  for (const e of ofType(events, "choice", dive)) {
    if (e.payload.choice !== "deeper" || e.payload.margin_at_choice >= 0) continue;
    total++;
    if (e.payload.crew_present) withCrew++;
  }
  return { total, withCrew };
}

export function lostDivers(events: readonly StoredAirtimeEvent[], dive: number): string[] {
  return ofType(events, "out_of_air", dive).flatMap((e) => e.payload.lost_participant_ids);
}

export function hauls(events: readonly StoredAirtimeEvent[], dive: number): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of ofType(events, "surfaced", dive)) out.set(e.payload.participant_id, e.payload.haul);
  return out;
}

export type MetricBoat = { boatId: string; name: string; memberIds: string[] };

export function boatTotals(
  events: readonly StoredAirtimeEvent[],
  dive: number,
  boats: readonly MetricBoat[]
): Map<string, number> {
  const totals = new Map<string, number>(boats.map((b) => [b.boatId, 0]));
  for (const e of ofType(events, "surfaced", dive)) {
    totals.set(e.payload.boat_id, (totals.get(e.payload.boat_id) ?? 0) + e.payload.haul);
  }
  return totals;
}

export type Rival = { name: string; diveScore: number } | null;

/** Divers whose haul was ≤ 2 on a boat that beat the average boat score for that dive. */
export function enablers(
  events: readonly StoredAirtimeEvent[],
  dive: number,
  boats: readonly MetricBoat[],
  rival: Rival
): { boatId: string; participantId: string; haul: number }[] {
  const totals = boatTotals(events, dive, boats);
  const all = [...Array.from(totals.values()), ...(rival ? [rival.diveScore] : [])];
  if (all.length === 0) return [];
  const average = all.reduce((a, b) => a + b, 0) / all.length;
  const surfaced = ofType(events, "surfaced", dive);
  return surfaced
    .filter((e) => e.payload.haul <= ENABLER_MAX_HAUL && (totals.get(e.payload.boat_id) ?? 0) > average)
    .map((e) => ({ boatId: e.payload.boat_id, participantId: e.payload.participant_id, haul: e.payload.haul }));
}

export type TrendRow = {
  dive: number;
  boats: { boatId: string; total: number; firstSurfaceTurn: number | null; lost: number }[];
};

export function trend(events: readonly StoredAirtimeEvent[], boats: readonly MetricBoat[]): TrendRow[] {
  return divesPlayed(events).map((dive) => {
    const totals = boatTotals(events, dive, boats);
    const first = firstSurfaceTurns(events, dive);
    const lostByBoat = new Map<string, number>();
    for (const e of ofType(events, "out_of_air", dive)) {
      lostByBoat.set(e.payload.boat_id, e.payload.lost_participant_ids.length);
    }
    return {
      dive,
      boats: boats.map((b) => ({
        boatId: b.boatId,
        total: totals.get(b.boatId) ?? 0,
        firstSurfaceTurn: first.get(b.boatId) ?? null,
        lost: lostByBoat.get(b.boatId) ?? 0,
      })),
    };
  });
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export type HighlightInput = {
  events: readonly StoredAirtimeEvent[];
  boats: readonly MetricBoat[];
  rival: Rival;
  names: ReadonlyMap<string, string>;
  showNames: boolean;
};

/** One paragraph per dive played (spec §14). */
export function buildHighlightCard(input: HighlightInput): string[] {
  const { events, boats, rival, names, showNames } = input;
  return divesPlayed(events).map((dive) => {
    const parts: string[] = [];

    const firsts = Array.from(firstSurfaceTurns(events, dive).values());
    if (firsts.length === 0) parts.push("no diver reached the surface.");
    else {
      const earliest = Math.min(...firsts);
      parts.push(
        earliest <= 1
          ? "first crew surfaced on turn 1."
          : `no boat had crew on the surface until turn ${earliest}.`
      );
    }

    const danger = dangerChoices(events, dive);
    if (danger.total > 0) {
      parts.push(
        `Divers chose Dive Deeper ${plural(danger.total, "time", "times")} while their boat's air couldn't bring everyone back, ${danger.withCrew} of those with crew on the surface.`
      );
    }

    const lost = lostDivers(events, dive).length;
    parts.push(lost === 0 ? "Nobody was lost." : `${plural(lost, "diver", "divers")} lost their treasure.`);

    const totals = boatTotals(events, dive, boats);
    const candidates = [
      ...boats.map((b) => ({ boatId: b.boatId, total: totals.get(b.boatId) ?? 0 })),
      ...(rival ? [{ boatId: "__rival__", total: rival.diveScore }] : []),
    ].sort((a, b) => b.total - a.total);
    const winner = candidates[0];
    if (winner) {
      const winningEnablers =
        winner.boatId === "__rival__"
          ? []
          : enablers(events, dive, boats, rival).filter((e) => e.boatId === winner.boatId);
      let sentence = `The winning boat scored ${winner.total}`;
      if (winningEnablers.length > 0) {
        const values = new Set(winningEnablers.map((e) => e.haul));
        const only = values.size === 1 ? Array.from(values)[0] : undefined;
        const amount =
          only === undefined ? "2 points or less each" : `${plural(only, "point", "points")} each`;
        const who = showNames
          ? joinNames(winningEnablers.map((e) => names.get(e.participantId) ?? "Someone"))
          : plural(winningEnablers.length, "diver", "divers");
        sentence += `, with ${who} bringing up ${amount}`;
      }
      parts.push(`${sentence}.`);
    }

    return `Dive ${dive}: ${parts.join(" ")}`;
  });
}
