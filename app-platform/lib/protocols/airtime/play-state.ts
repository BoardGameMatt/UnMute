import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AIRTIME_CONFIG, cardById } from "./config";
import {
  GAUGE_LABEL,
  airAtDepth,
  airNeededNow,
  airToSurface,
  boatIsBack,
  cardValue,
  gaugeBand,
  gaugeSegments,
  marginFor,
  progressRatio,
  rankBoats,
} from "./engine";
import { expireIfNeeded } from "./actions";
import {
  loadAirtimeSession,
  loadBoatDives,
  loadBoats,
  loadChoices,
  loadDiverDives,
  loadMembers,
  loadRoster,
  playersOf,
  type AirtimeBoatRow,
  type AirtimeDiverDiveRow,
  type AirtimeMemberRow,
  type AirtimeSessionRow,
} from "./store";
import type {
  AirtimePhase,
  AirtimePlayState,
  CrewView,
  DiveState,
  DiverState,
  DiverView,
  HaulRow,
  PublicBoat,
  StandingRow,
  ViewerRole,
} from "./types";

/** Runs the server clock, then builds this viewer's state (null before Start). */
export async function loadAirtimePlayState(input: {
  admin: SupabaseClient;
  sessionId: string;
  participantId: string;
  isDisplay: boolean;
  canControl: boolean;
  skipMaintenance?: boolean;
}): Promise<AirtimePlayState | null> {
  const { skipMaintenance, ...rest } = input;
  if (!skipMaintenance) await expireIfNeeded(input.admin, input.sessionId);
  const row = await loadAirtimeSession(input.admin, input.sessionId);
  if (!row) return null;
  return buildAirtimePlayState({ ...rest, row });
}

function progressFor(phase: AirtimePhase, dive: number): number {
  if (phase === "final") return progressRatio(3);
  if (phase === "dive_active" || phase === "dive_results") return progressRatio(dive >= 2 ? 2 : 1);
  return 0;
}

function haulFromDiver(d: DiverState, names: Map<string, string>): HaulRow {
  const card = cardById(d.itemId);
  const status = d.status === "underwater" ? "forfeit" : d.status;
  return {
    participantId: d.participantId,
    displayName: names.get(d.participantId) ?? "Player",
    boatId: d.boatId,
    itemId: d.itemId,
    itemName: card?.name ?? "Treasure",
    level: card?.level ?? d.deepest,
    value: d.haul,
    status,
    lostValue: status === "surfaced" ? null : cardValue(d.itemId),
  };
}

function haulFromRow(r: AirtimeDiverDiveRow, names: Map<string, string>): HaulRow {
  const card = cardById(r.item_id);
  return {
    participantId: r.participant_id,
    displayName: names.get(r.participant_id) ?? "Player",
    boatId: r.boat_id,
    itemId: r.item_id,
    itemName: card?.name ?? "Treasure",
    level: card?.level ?? r.deepest,
    value: r.haul,
    status: r.status,
    lostValue: r.status === "surfaced" ? null : cardValue(r.item_id),
  };
}

function byName<T extends { displayName: string }>(a: T, b: T): number {
  return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" });
}

function publicBoats(
  boats: AirtimeBoatRow[],
  members: AirtimeMemberRow[],
  names: Map<string, string>
): PublicBoat[] {
  return boats
    .filter((b) => !b.is_rival)
    .map((b) => ({
      id: b.id,
      name: b.name,
      members: members
        .filter((m) => m.boat_id === b.id)
        .map((m) => ({ participantId: m.participant_id, displayName: names.get(m.participant_id) ?? "Player" }))
        .sort(byName),
    }));
}

function diverView(
  dive: DiveState,
  me: DiverState,
  chosen: DiverView["chosen"],
  names: Map<string, string>
): DiverView {
  const boat = dive.boats.find((b) => b.boatId === me.boatId);
  const band = gaugeBand(boat?.tank ?? 0, boat?.tankStart ?? 1);
  const card = cardById(me.itemId);
  return {
    depth: me.depth,
    deepest: me.deepest,
    status: me.status,
    item: {
      id: me.itemId,
      name: card?.name ?? "Treasure",
      level: card?.level ?? me.deepest,
      value: null,
    },
    chosen,
    canDeeper: me.depth < AIRTIME_CONFIG.maxDepth,
    gauge: { band, label: GAUGE_LABEL[band], segments: gaugeSegments(band) },
    boatmates: dive.divers
      .filter((d) => d.boatId === me.boatId && d.participantId !== me.participantId)
      .map((d) => ({
        participantId: d.participantId,
        displayName: names.get(d.participantId) ?? "Player",
        status: d.status,
      }))
      .sort(byName),
  };
}

function crewView(dive: DiveState, boatId: string, names: Map<string, string>): CrewView {
  const boat = dive.boats.find((b) => b.boatId === boatId);
  const mates = dive.divers.filter((d) => d.boatId === boatId);
  const tank = boat?.tank ?? 0;
  return {
    tank,
    tankStart: boat?.tankStart ?? 0,
    airNeeded: airNeededNow(mates),
    margin: marginFor(tank, mates),
    rows: mates
      .map((d) => {
        const under = d.status === "underwater";
        return {
          participantId: d.participantId,
          displayName: names.get(d.participantId) ?? "Player",
          status: d.status,
          depth: under ? d.depth : 0,
          airPerTurn: under ? airAtDepth(d.depth) : 0,
          airToSurface: under ? airToSurface(d.depth) : 0,
        };
      })
      .sort(byName),
  };
}

export async function buildAirtimePlayState(input: {
  admin: SupabaseClient;
  sessionId: string;
  participantId: string;
  isDisplay: boolean;
  canControl: boolean;
  row: AirtimeSessionRow;
}): Promise<AirtimePlayState> {
  const { admin, sessionId, participantId, isDisplay, canControl, row } = input;

  const [roster, boats, members] = await Promise.all([
    loadRoster(admin, sessionId),
    loadBoats(admin, sessionId),
    loadMembers(admin, sessionId),
  ]);
  const names = new Map(roster.map((r) => [r.participantId, r.displayName]));
  const myMembership = isDisplay ? null : members.find((m) => m.participant_id === participantId) ?? null;
  const myBoatId = myMembership?.boat_id ?? null;
  const pub = publicBoats(boats, members, names);

  const dive = row.dive_state_json;
  const meDiver =
    !isDisplay && dive ? dive.divers.find((d) => d.participantId === participantId) ?? null : null;

  let viewerRole: ViewerRole = isDisplay ? "display" : myBoatId ? "boat" : "spectator";
  let diver: DiverView | null = null;
  let crew: CrewView | null = null;
  let myResult: HaulRow | null = null;

  if (row.phase === "dive_active" && dive && meDiver) {
    if (meDiver.status === "underwater") {
      viewerRole = "diver";
      const choices = await loadChoices(admin, sessionId, row.current_dive, row.current_turn + 1);
      diver = diverView(dive, meDiver, choices[participantId] ?? null, names);
    } else {
      myResult = haulFromDiver(meDiver, names);
      if (boatIsBack(dive, meDiver.boatId)) {
        viewerRole = "waiting";
      } else {
        viewerRole = "crew";
        crew = crewView(dive, meDiver.boatId, names);
      }
    }
  }

  let results: AirtimePlayState["results"] = null;
  let final: AirtimePlayState["final"] = null;

  if (row.phase === "dive_results" || row.phase === "final") {
    const [diverDives, boatDives] = await Promise.all([
      loadDiverDives(admin, sessionId),
      loadBoatDives(admin, sessionId),
    ]);
    if (row.phase === "dive_results") {
      const hauls = diverDives
        .filter((r) => r.dive_number === row.current_dive)
        .map((r) => haulFromRow(r, names))
        .sort(byName);
      if (!isDisplay) myResult = hauls.find((h) => h.participantId === participantId) ?? null;
      results = { dive: row.current_dive, hauls };
    }

    if (row.phase === "final") {
      const diveNumbers = Array.from(new Set(boatDives.map((b) => b.dive_number))).sort((a, b) => a - b);
      const standingsInput = boats.map((b) => {
        const diveTotals = diveNumbers.map(
          (n) => boatDives.find((x) => x.boat_id === b.id && x.dive_number === n)?.result ?? 0
        );
        return { boatId: b.id, diveTotals, total: diveTotals.reduce((s, v) => s + v, 0) };
      });
      const { ranked, winnerIds } = rankBoats(standingsInput);
      const personal = new Map<string, number>();
      for (const r of diverDives) personal.set(r.participant_id, (personal.get(r.participant_id) ?? 0) + r.haul);

      const standings: StandingRow[] = ranked.map((s) => {
        const boat = boats.find((b) => b.id === s.boatId);
        return {
          boatId: s.boatId,
          name: boat?.name ?? "Boat",
          isRival: Boolean(boat?.is_rival),
          diveTotals: s.diveTotals,
          total: s.total,
          isWinner: winnerIds.includes(s.boatId),
          members: members
            .filter((m) => m.boat_id === s.boatId)
            .map((m) => ({
              participantId: m.participant_id,
              displayName: names.get(m.participant_id) ?? "Player",
              personalTotal: personal.get(m.participant_id) ?? 0,
            }))
            .sort(byName),
        };
      });

      final = { standings, winnerIds };
    }
  }

  const players = playersOf(roster);
  const me = isDisplay ? null : { participantId, displayName: names.get(participantId) ?? "Player" };
  return {
    sessionId,
    phase: row.phase,
    viewerRole,
    isDisplay,
    canControl,
    serverNow: new Date().toISOString(),
    progress: progressFor(row.phase, row.current_dive),
    diveNumber: row.current_dive,
    maxDives: AIRTIME_CONFIG.maxDives,
    turn: row.current_turn + 1,
    maxTurns: AIRTIME_CONFIG.maxTurnsPerDive,
    windowOpensAt: row.phase === "dive_active" ? row.window_opens_at : null,
    turnSeconds: AIRTIME_CONFIG.turnSeconds,
    endBannerUntil: row.end_banner_until,
    endAfterTurn: row.end_after_turn,
    revealed: row.revealed,
    boats: pub,
    myBoatId,
    me,
    playerCount: players.length,
    diver,
    crew,
    myResult,
    results,
    final,
  };
}
