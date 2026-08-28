import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { expireIfNeeded } from "./actions";
import {
  GUESS_SECONDS,
  TEAM_DISCUSS_SECONDS,
  assignmentForViewer,
  exactMatch,
  legalLots,
} from "./engine";
import {
  asAssignment,
  asCells,
  asLetteredLots,
  lotsAreLettered,
} from "./actions";
import {
  displayNameMap,
  loadBuildingsByIds,
  loadGuesses,
  loadRound,
  loadRounds,
  loadRoster,
  loadZoningSession,
  resolvePackId,
  loadActiveBuildings,
} from "./store";
import {
  HALL_COL,
  HALL_ROW,
  IND_K,
  MIN_INDIVIDUAL_BEFORE_TEAM,
  REQUIRED_INDIVIDUAL_ROUNDS,
  REQUIRED_TEAM_ROUNDS,
  TEAM_K,
  type OccupiedCellView,
  type ZoningRightsPlayState,
  type ZoningRightsViewerRole,
} from "./types";

const REVEAL_PHASES = new Set(["IND_REVEAL", "TEAM_REVEAL", "SCOREBOARD"]);

function progressFor(phase: string, individualRoundIndex: number, teamRoundIndex: number): number {
  const denom = REQUIRED_INDIVIDUAL_ROUNDS + 1 + REQUIRED_TEAM_ROUNDS;
  let done = Math.min(REQUIRED_INDIVIDUAL_ROUNDS, Math.max(0, individualRoundIndex - 1));
  if (phase === "IND_REVEAL") {
    done = Math.min(REQUIRED_INDIVIDUAL_ROUNDS, individualRoundIndex);
  }
  if (phase === "TEAM_INTRO" || phase.startsWith("TEAM_")) {
    done = REQUIRED_INDIVIDUAL_ROUNDS;
  }
  if (phase === "TEAM_INTRO") done += 0;
  else if (phase.startsWith("TEAM_")) {
    done += 1;
    if (phase === "TEAM_REVEAL" || phase === "SCOREBOARD") {
      done += teamRoundIndex;
    } else {
      done += Math.max(0, teamRoundIndex - 1);
    }
  }
  if (phase === "SCOREBOARD") done = denom;
  return Math.min(1, done / denom);
}

function instructionFor(
  role: ZoningRightsViewerRole,
  phase: string,
  names: { planner: string | null; zm: string | null; ld: string | null },
  k: number,
  isLead: boolean
): string {
  if (role === "zoning_manager" && (phase === "IND_ZM_ASSIGN" || phase === "TEAM_ZM_ASSIGN")) {
    if (isLead) {
      return "Unshare your screen and make your selections in private. Tap a building, then tap the lot. Tap the name on a lot to take it back.";
    }
    return "Tap the building you want to place, then tap the lot. Tap the name under a lot to take a building back.";
  }
  if (role === "zoning_manager" && phase === "IND_GUESS") {
    return "Camera off. Mute yourself. Come back when everyone has locked in.";
  }
  if (role === "zoning_manager" && (phase === "TEAM_DISCUSS" || phase === "TEAM_LOCK")) {
    return "Camera off. Mute yourself. Come back when the two-minute timer ends.";
  }
  if (role === "zoning_manager" && REVEAL_PHASES.has(phase)) {
    return "You can come back on camera and unmute.";
  }
  if (phase === "IND_PLANNER_PICK" || phase === "TEAM_PLANNER_PICK") {
    if (role === "planner") {
      return `Pick the next ${k} lots to develop — then the Zoning Manager will place ${k} buildings.`;
    }
    return names.planner
      ? `Waiting on ${names.planner} to pick the lots.`
      : "Watch the shared screen. Lots are being chosen.";
  }
  if (phase === "IND_ZM_ASSIGN" || phase === "TEAM_ZM_ASSIGN") {
    return names.zm
      ? `Waiting on ${names.zm} to zone the lots.`
      : "Zoning in progress.";
  }
  if (phase === "IND_GUESS") {
    return "Match the Zoning Manager exactly. All lots, or it does not count. Read the map on the shared screen.";
  }
  if (phase === "TEAM_INTRO") {
    return "There are now 4 buildings at a time. Only one person (the Lead Developer) will choose for the team.";
  }
  if (phase === "TEAM_DISCUSS" || phase === "TEAM_LOCK") {
    const ld = names.ld ?? "the Lead Developer";
    if (role === "lead_developer") {
      return "Tap a building, then tap the lot. Tap the name on a lot to take it back. Lock it in when the team agrees, or wait for the timer.";
    }
    return `Discuss as a team. Zoning Manager is off camera — no hints. You can see the same map as ${ld}. Only they can place.`;
  }
  return "";
}

export async function buildZoningRightsPlayState(input: {
  admin: SupabaseClient;
  sessionId: string;
  participantId: string;
  isLead: boolean;
  skipMaintenance?: boolean;
}): Promise<ZoningRightsPlayState> {
  const { admin, sessionId, participantId, isLead, skipMaintenance } = input;
  if (!skipMaintenance) {
    await expireIfNeeded(admin, sessionId);
  }

  const zr = await loadZoningSession(admin, sessionId);
  const roster = await loadRoster(admin, sessionId);
  const names = displayNameMap(roster);
  const round = zr?.current_round_id ? await loadRound(admin, zr.current_round_id) : null;
  const rounds = await loadRounds(admin, sessionId);

  const phase = zr?.phase ?? "IND_PLANNER_PICK";
  const revealed = REVEAL_PHASES.has(phase);
  const zmId = round?.zm_id ?? null;
  const plannerId = round?.planner_id ?? null;
  const ldId = round?.lead_developer_id ?? null;

  let viewerRole: ZoningRightsViewerRole = "watcher";
  if (participantId === zmId) viewerRole = "zoning_manager";
  else if (phase === "TEAM_DISCUSS" && participantId === ldId) viewerRole = "lead_developer";
  else if (phase === "TEAM_LOCK" && participantId === ldId) viewerRole = "lead_developer";
  else if (
    (phase === "IND_PLANNER_PICK" || phase === "TEAM_PLANNER_PICK") &&
    (participantId === plannerId || (isLead && zr?.individual_round_index === 1 && zr.mode === "individual"))
  ) {
    viewerRole = "planner";
  } else if (phase === "IND_GUESS" && participantId !== zmId) {
    viewerRole = "guesser";
  }

  const board = zr?.board_json ?? { occupants: {} };
  const consumed = new Set<string>();
  const occupied: OccupiedCellView[] = [];
  const boardBuildingIds: string[] = [];
  occupied.push({
    col: HALL_COL,
    row: HALL_ROW,
    kind: "hall",
    buildingId: null,
    name: "CITY HALL",
  });
  consumed.add(`${HALL_COL},${HALL_ROW}`);
  for (const [key, occ] of Object.entries(board.occupants)) {
    if (occ.kind !== "building") continue;
    const [c, r] = key.split(",").map(Number);
    if (!Number.isInteger(c) || !Number.isInteger(r)) continue;
    boardBuildingIds.push(occ.buildingId);
    occupied.push({
      col: c,
      row: r,
      kind: "building",
      buildingId: occ.buildingId,
      name: "",
    });
  }

  const nameRows = await loadBuildingsByIds(admin, [
    ...boardBuildingIds,
    ...(round?.building_ids ?? []),
  ]);
  const buildingName = (id: string) => nameRows.find((b) => b.id === id)?.name ?? "Building";
  for (const cell of occupied) {
    if (cell.buildingId) cell.name = buildingName(cell.buildingId);
  }

  const lots = round && lotsAreLettered(round.lots_json) ? asLetteredLots(round.lots_json) : [];
  const selectedLots =
    round && !lotsAreLettered(round.lots_json) ? asCells(round.lots_json) : lots.map((l) => ({ col: l.col, row: l.row }));

  const guesses = round ? await loadGuesses(admin, round.id) : [];
  const mine = guesses.find((g) => g.participant_id === participantId);
  const zmAssignmentRaw = asAssignment(round?.zm_assignment_json ?? null);
  const zmAssignment = assignmentForViewer(
    participantId,
    zmId,
    revealed,
    Object.keys(zmAssignmentRaw).length ? zmAssignmentRaw : null
  );

  const showBuildings =
    Boolean(round && round.building_ids.length > 0) &&
    (viewerRole === "zoning_manager" ||
      phase === "IND_GUESS" ||
      phase === "TEAM_DISCUSS" ||
      phase === "TEAM_LOCK" ||
      revealed);

  const buildings = showBuildings
    ? (round?.building_ids ?? []).map((id) => ({ id, name: buildingName(id) }))
    : [];

  const guesserIds = roster.map((r) => r.participantId).filter((id) => id !== zmId);
  const lockedInCount = guesses.filter((g) => g.locked_at).length;

  const exactMatchNames =
    phase === "IND_REVEAL"
      ? guesses
          .filter((g) => g.is_exact)
          .map((g) => names[g.participant_id] ?? "Player")
      : [];

  const teamGuess =
    phase === "TEAM_DISCUSS" || phase === "TEAM_LOCK" || phase === "TEAM_REVEAL"
      ? asAssignment(round?.team_guess_json ?? null)
      : null;

  let teamHit: boolean | null = null;
  if (phase === "TEAM_REVEAL" && teamGuess && Object.keys(zmAssignmentRaw).length) {
    teamHit = exactMatch(teamGuess, zmAssignmentRaw);
  }

  const packId = await resolvePackId(admin, sessionId).catch(() => null);
  const allBuildings = packId ? await loadActiveBuildings(admin, packId) : [];
  const usedCount = new Set([
    ...boardBuildingIds,
    ...rounds.flatMap((r) => r.building_ids),
  ]).size;

  let timerStartedAt: string | null = null;
  let timerSeconds: number | null = null;
  if (phase === "IND_GUESS") {
    timerStartedAt = round?.guess_started_at ?? null;
    timerSeconds = GUESS_SECONDS;
  } else if (phase === "TEAM_DISCUSS") {
    timerStartedAt = round?.discuss_started_at ?? null;
    timerSeconds = TEAM_DISCUSS_SECONDS;
  }

  const buildingsRemaining = Math.max(0, allBuildings.length - usedCount);
  const remainingLots = legalLots(board);
  const lotsLeft = remainingLots.length;
  const roundIndex = zr?.individual_round_index ?? 1;

  const canPickLots =
    (phase === "IND_PLANNER_PICK" || phase === "TEAM_PLANNER_PICK") &&
    (participantId === plannerId ||
      (isLead && zr?.mode === "individual" && zr.individual_round_index === 1));

  const myGuess = mine ? asAssignment(mine.assignment_json) : null;

  const canContinue =
    isLead &&
    (phase === "TEAM_INTRO" ||
      (phase === "IND_REVEAL" &&
        roundIndex < REQUIRED_INDIVIDUAL_ROUNDS &&
        buildingsRemaining >= IND_K &&
        lotsLeft >= IND_K));
  const canAnotherRound =
    isLead &&
    ((phase === "IND_REVEAL" &&
      roundIndex >= REQUIRED_INDIVIDUAL_ROUNDS &&
      buildingsRemaining >= IND_K &&
      lotsLeft >= IND_K) ||
      (phase === "TEAM_REVEAL" && buildingsRemaining >= TEAM_K && lotsLeft >= TEAM_K));
  const canMoveToTeamPlay =
    isLead &&
    phase === "IND_REVEAL" &&
    roundIndex >= MIN_INDIVIDUAL_BEFORE_TEAM &&
    buildingsRemaining >= TEAM_K &&
    lotsLeft >= TEAM_K;
  const canWrapUp =
    isLead &&
    (phase === "TEAM_REVEAL" ||
      (phase === "IND_REVEAL" && !canContinue && !canAnotherRound && !canMoveToTeamPlay));

  return {
    phase,
    mode: zr?.mode ?? "individual",
    individualRoundIndex: zr?.individual_round_index ?? 1,
    teamRoundIndex: zr?.team_round_index ?? 0,
    isLead,
    participantId,
    viewerRole,
    instruction: instructionFor(
      viewerRole,
      phase,
      {
        planner: plannerId ? names[plannerId] ?? null : null,
        zm: zmId ? names[zmId] ?? null : null,
        ld: ldId ? names[ldId] ?? null : null,
      },
      round?.k ?? 3,
      isLead
    ),
    progress: progressFor(phase, zr?.individual_round_index ?? 1, zr?.team_round_index ?? 0),
    k: round?.k ?? 3,
    plannerName: plannerId ? names[plannerId] ?? null : null,
    zmName: zmId ? names[zmId] ?? null : null,
    leadDeveloperName: ldId ? names[ldId] ?? null : null,
    canPickLots,
    canAssignZm:
      (phase === "IND_ZM_ASSIGN" || phase === "TEAM_ZM_ASSIGN") && participantId === zmId,
    canGuess: phase === "IND_GUESS" && participantId !== zmId && !mine?.locked_at,
    canTeamLock:
      (phase === "TEAM_DISCUSS" || phase === "TEAM_LOCK") && participantId === ldId,
    canContinue,
    canAnotherRound,
    canMoveToTeamPlay,
    canWrapUp,
    lockedInCount,
    guesserCount: guesserIds.length,
    buildingsRemaining,
    occupied,
    legalLots: remainingLots,
    selectedLots,
    lots,
    buildings,
    zmAssignment,
    myGuess,
    myGuessLocked: Boolean(mine?.locked_at),
    teamGuess: teamGuess && Object.keys(teamGuess).length ? teamGuess : null,
    exactMatchNames,
    teamHit,
    timerStartedAt,
    timerSeconds,
  };
}
