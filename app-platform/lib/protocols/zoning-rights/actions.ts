import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/lib/types/database";
import {
  IND_K,
  MIN_INDIVIDUAL_BEFORE_TEAM,
  REQUIRED_INDIVIDUAL_ROUNDS,
  TEAM_K,
  type Assignment,
  type Cell,
  type LetteredLot,
  type ZoningBoard,
  type ZoningRightsAction,
  type ZoningRightsMode,
  type ZoningRightsPhase,
} from "./types";
import {
  GUESS_SECONDS,
  TEAM_DISCUSS_SECONDS,
  assignmentComplete,
  consumedBuildingIds,
  drawOpeningCross,
  exactMatch,
  isLegalLot,
  legalLots,
  letterLots,
  pickExclusiveRole,
  placeBuildingsOnLots,
  shuffleCopy,
  timerHasExpired,
} from "./engine";
import {
  connectedIds,
  displayNameMap,
  leadId,
  loadActiveBuildings,
  loadGuesses,
  loadRound,
  loadRounds,
  loadRoster,
  loadZoningSession,
  resolvePackId,
  syncPublicState,
  type RosterMember,
  type ZoningRightsRoundRow,
  type ZoningRightsSessionRow,
} from "./store";

type ActionOk = { ok: true };
type ActionErr = { ok: false; status: number; error: string };
export type ZoningRightsActionResult = ActionOk | ActionErr;

function fail(status: number, error: string): ActionErr {
  return { ok: false, status, error };
}

function asAssignment(value: Json | null | undefined): Assignment {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Assignment = {};
  for (const [key, val] of Object.entries(value)) {
    if (typeof val === "string") out[key] = val;
  }
  return out;
}

function asCells(value: Json): Cell[] {
  if (!Array.isArray(value)) return [];
  const cells: Cell[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const col = Number((item as { col?: unknown }).col);
    const row = Number((item as { row?: unknown }).row);
    if (!Number.isInteger(col) || !Number.isInteger(row)) continue;
    cells.push({ col, row });
  }
  return cells;
}

function asLetteredLots(value: Json): LetteredLot[] {
  if (!Array.isArray(value)) return [];
  const lots: LetteredLot[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const letter = (item as { letter?: unknown }).letter;
    const col = Number((item as { col?: unknown }).col);
    const row = Number((item as { row?: unknown }).row);
    if (typeof letter !== "string" || !Number.isInteger(col) || !Number.isInteger(row)) continue;
    lots.push({ letter, col, row });
  }
  return lots;
}

function lotsAreLettered(value: Json): boolean {
  return asLetteredLots(value).length > 0;
}

async function poke(
  admin: SupabaseClient,
  sessionId: string,
  phase: ZoningRightsPhase,
  extra: Record<string, Json> = {}
): Promise<void> {
  await syncPublicState(admin, sessionId, phase, extra);
}

async function patchSession(
  admin: SupabaseClient,
  sessionId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const { error } = await admin
    .from("zoning_rights_sessions")
    .update(patch)
    .eq("session_id", sessionId);
  if (error) throw new Error(error.message);
}

async function patchRound(
  admin: SupabaseClient,
  roundId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const { error } = await admin.from("zoning_rights_rounds").update(patch).eq("id", roundId);
  if (error) throw new Error(error.message);
}

function previousZmIds(rounds: ZoningRightsRoundRow[], currentRoundId: string | null): string[] {
  return rounds
    .filter((r) => r.id !== currentRoundId && r.zm_id)
    .map((r) => r.zm_id as string);
}

function previousLdIds(rounds: ZoningRightsRoundRow[], currentRoundId: string | null): string[] {
  return rounds
    .filter((r) => r.id !== currentRoundId && r.lead_developer_id)
    .map((r) => r.lead_developer_id as string);
}

function lastZmId(rounds: ZoningRightsRoundRow[]): string | null {
  for (let i = rounds.length - 1; i >= 0; i--) {
    if (rounds[i]?.zm_id) return rounds[i]!.zm_id;
  }
  return null;
}

function pickNamedRole(
  roster: RosterMember[],
  excludeIds: Array<string | null | undefined>,
  alreadyIds: string[]
): string | null {
  const live = connectedIds(roster);
  const picked = pickExclusiveRole(live, excludeIds, alreadyIds);
  if (picked) return picked;
  return pickExclusiveRole(
    roster.map((row) => row.participantId),
    excludeIds,
    alreadyIds
  );
}

function sanitizeLotPicks(board: ZoningBoard, cells: Cell[], k: number): Cell[] {
  const unique: Cell[] = [];
  const seen = new Set<string>();
  for (const cell of cells) {
    const key = `${cell.col},${cell.row}`;
    if (seen.has(key)) continue;
    if (!isLegalLot(board, cell.col, cell.row)) continue;
    seen.add(key);
    unique.push(cell);
    if (unique.length === k) break;
  }
  return unique;
}

async function unusedBuildingIds(
  admin: SupabaseClient,
  sessionId: string,
  packId: string,
  board: ZoningBoard
): Promise<string[]> {
  const buildings = await loadActiveBuildings(admin, packId);
  const used = new Set(consumedBuildingIds(board));
  const rounds = await loadRounds(admin, sessionId);
  for (const round of rounds) {
    for (const id of round.building_ids) used.add(id);
  }
  return buildings.map((b) => b.id).filter((id) => !used.has(id));
}

async function dealBuildings(
  admin: SupabaseClient,
  sessionId: string,
  packId: string,
  board: ZoningBoard,
  k: number,
  random: () => number = Math.random
): Promise<string[] | null> {
  const unused = await unusedBuildingIds(admin, sessionId, packId, board);
  if (unused.length < k) return null;
  return shuffleCopy(unused, random).slice(0, k);
}

export async function resetZoningRightsToLobby(
  admin: SupabaseClient,
  sessionId: string
): Promise<void> {
  await admin.from("zoning_rights_sessions").update({ current_round_id: null }).eq("session_id", sessionId);
  await admin.from("zoning_rights_rounds").delete().eq("session_id", sessionId);
  await admin.from("zoning_rights_sessions").delete().eq("session_id", sessionId);
}

async function insertRound(
  admin: SupabaseClient,
  args: {
    sessionId: string;
    mode: ZoningRightsMode;
    roundIndex: number;
    plannerId: string;
    zmId?: string | null;
    k: number;
    introStartedAt?: string | null;
  }
): Promise<string> {
  const { data, error } = await admin
    .from("zoning_rights_rounds")
    .insert({
      session_id: args.sessionId,
      mode: args.mode,
      round_index: args.roundIndex,
      planner_id: args.plannerId,
      zm_id: args.zmId ?? null,
      k: args.k,
      lots_json: [],
      building_ids: [],
      intro_started_at: args.introStartedAt ?? null,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create round.");
  return data.id as string;
}

export async function startZoningRights(
  admin: SupabaseClient,
  sessionId: string
): Promise<ZoningRightsActionResult> {
  const roster = await loadRoster(admin, sessionId);
  if (roster.length < 3) {
    return fail(400, "Need 3 to start.");
  }
  const planner = leadId(roster);
  if (!planner) {
    return fail(400, "A facilitator has to claim lead before start.");
  }
  const zm = pickNamedRole(roster, [planner], []);
  if (!zm) {
    return fail(400, "Need someone else to be Zoning Manager.");
  }

  const packId = await resolvePackId(admin, sessionId);
  await resetZoningRightsToLobby(admin, sessionId);

  const buildings = await loadActiveBuildings(admin, packId);
  if (buildings.length < 16) {
    return fail(500, "Pack A is not installed.");
  }

  const { board } = drawOpeningCross(buildings.map((b) => b.id));

  const { error: sessErr } = await admin.from("zoning_rights_sessions").insert({
    session_id: sessionId,
    phase: "IND_PLANNER_PICK",
    mode: "individual",
    individual_round_index: 1,
    team_round_index: 0,
    board_json: board,
  });
  if (sessErr) throw new Error(sessErr.message);

  const roundId = await insertRound(admin, {
    sessionId,
    mode: "individual",
    roundIndex: 1,
    plannerId: planner,
    zmId: zm,
    k: IND_K,
  });
  await patchSession(admin, sessionId, { current_round_id: roundId });
  await poke(admin, sessionId, "IND_PLANNER_PICK");
  return { ok: true };
}

async function beginIndividualRound(
  admin: SupabaseClient,
  zr: ZoningRightsSessionRow,
  roster: RosterMember[],
  rounds: ZoningRightsRoundRow[]
): Promise<ZoningRightsActionResult> {
  const nextIndex = zr.individual_round_index + 1;
  const planner = lastZmId(rounds) ?? leadId(roster);
  if (!planner) return fail(400, "No city planner available.");
  const zm = pickNamedRole(roster, [planner], previousZmIds(rounds, null));
  if (!zm) return fail(400, "Need someone else to be Zoning Manager.");
  const roundId = await insertRound(admin, {
    sessionId: zr.session_id,
    mode: "individual",
    roundIndex: nextIndex,
    plannerId: planner,
    zmId: zm,
    k: IND_K,
  });
  await patchSession(admin, zr.session_id, {
    phase: "IND_PLANNER_PICK",
    mode: "individual",
    individual_round_index: nextIndex,
    current_round_id: roundId,
  });
  await poke(admin, zr.session_id, "IND_PLANNER_PICK");
  return { ok: true };
}

async function beginTeamRound(
  admin: SupabaseClient,
  zr: ZoningRightsSessionRow,
  roster: RosterMember[],
  rounds: ZoningRightsRoundRow[],
  intro: boolean
): Promise<ZoningRightsActionResult> {
  const nextIndex = zr.team_round_index + 1;
  const planner = lastZmId(rounds) ?? leadId(roster);
  if (!planner) return fail(400, "No city planner available.");
  const zm = pickNamedRole(roster, [planner], previousZmIds(rounds, null));
  if (!zm) return fail(400, "Need someone else to be Zoning Manager.");
  const now = new Date().toISOString();
  const roundId = await insertRound(admin, {
    sessionId: zr.session_id,
    mode: "team",
    roundIndex: nextIndex,
    plannerId: planner,
    zmId: zm,
    k: TEAM_K,
    introStartedAt: intro ? now : null,
  });
  const phase: ZoningRightsPhase = intro ? "TEAM_INTRO" : "TEAM_PLANNER_PICK";
  await patchSession(admin, zr.session_id, {
    phase,
    mode: "team",
    team_round_index: nextIndex,
    current_round_id: roundId,
  });
  await poke(admin, zr.session_id, phase);
  return { ok: true };
}

async function revealIndividual(
  admin: SupabaseClient,
  zr: ZoningRightsSessionRow,
  round: ZoningRightsRoundRow
): Promise<void> {
  const lots = asLetteredLots(round.lots_json);
  const zm = asAssignment(round.zm_assignment_json);
  const guesses = await loadGuesses(admin, round.id);
  for (const guess of guesses) {
    const assignment = asAssignment(guess.assignment_json);
    const locked = Boolean(guess.locked_at) && assignmentComplete(assignment, round.k);
    const match = locked && exactMatch(assignment, zm);
    await admin
      .from("zoning_rights_guesses")
      .update({ is_exact: match, locked_at: guess.locked_at ?? new Date().toISOString() })
      .eq("id", guess.id);
  }
  const board = placeBuildingsOnLots(zr.board_json, lots, zm);
  await patchRound(admin, round.id, {
    ended_at: new Date().toISOString(),
    end_reason: "revealed",
  });
  await patchSession(admin, zr.session_id, {
    phase: "IND_REVEAL",
    board_json: board,
  });
  await poke(admin, zr.session_id, "IND_REVEAL");
}

async function revealTeam(
  admin: SupabaseClient,
  zr: ZoningRightsSessionRow,
  round: ZoningRightsRoundRow
): Promise<void> {
  const lots = asLetteredLots(round.lots_json);
  const zm = asAssignment(round.zm_assignment_json);
  const board = placeBuildingsOnLots(zr.board_json, lots, zm);
  await patchRound(admin, round.id, {
    ended_at: new Date().toISOString(),
    end_reason: "revealed",
  });
  await patchSession(admin, zr.session_id, {
    phase: "TEAM_REVEAL",
    board_json: board,
  });
  await poke(admin, zr.session_id, "TEAM_REVEAL", {
    teamGuess: asAssignment(round.team_guess_json) as unknown as Json,
  });
}

async function completeSession(admin: SupabaseClient, sessionId: string): Promise<void> {
  await patchSession(admin, sessionId, { phase: "SCOREBOARD" });
  await admin
    .from("sessions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", sessionId);
  await poke(admin, sessionId, "SCOREBOARD");
}

export async function expireIfNeeded(admin: SupabaseClient, sessionId: string): Promise<void> {
  const zr = await loadZoningSession(admin, sessionId);
  if (!zr?.current_round_id) return;
  const round = await loadRound(admin, zr.current_round_id);
  if (!round) return;
  const now = Date.now();

  if (zr.phase === "IND_GUESS" && timerHasExpired(round.guess_started_at, now, GUESS_SECONDS)) {
    await revealIndividual(admin, zr, round);
    return;
  }
  if (zr.phase === "TEAM_DISCUSS" && timerHasExpired(round.discuss_started_at, now, TEAM_DISCUSS_SECONDS)) {
    const freshRound = (await loadRound(admin, round.id)) ?? round;
    await revealTeam(admin, zr, freshRound);
    return;
  }
}

async function rerollDisconnected(
  admin: SupabaseClient,
  zr: ZoningRightsSessionRow,
  round: ZoningRightsRoundRow,
  roster: RosterMember[],
  rounds: ZoningRightsRoundRow[]
): Promise<void> {
  const live = connectedIds(roster);
  const zmPhases = new Set([
    "IND_PLANNER_PICK",
    "TEAM_PLANNER_PICK",
    "IND_ZM_ASSIGN",
    "TEAM_ZM_ASSIGN",
  ]);
  if (
    zmPhases.has(zr.phase) &&
    round.zm_id &&
    !live.includes(round.zm_id) &&
    !round.zm_assignment_json
  ) {
    const next = pickNamedRole(roster, [round.planner_id], previousZmIds(rounds, round.id));
    if (next) await patchRound(admin, round.id, { zm_id: next });
  }
  if (
    (zr.phase === "TEAM_DISCUSS" || zr.phase === "TEAM_LOCK") &&
    round.lead_developer_id &&
    !live.includes(round.lead_developer_id) &&
    !round.ended_at
  ) {
    const next = pickNamedRole(
      roster,
      [round.zm_id, round.planner_id],
      previousLdIds(rounds, round.id)
    );
    await patchRound(admin, round.id, {
      lead_developer_id: next,
      team_guess_json: {},
    });
  }
}

function canPickLots(
  zr: ZoningRightsSessionRow,
  round: ZoningRightsRoundRow,
  participantId: string,
  isLead: boolean
): boolean {
  if (zr.phase !== "IND_PLANNER_PICK" && zr.phase !== "TEAM_PLANNER_PICK") return false;
  if (participantId === round.planner_id) return true;
  if (isLead && zr.phase === "IND_PLANNER_PICK" && zr.individual_round_index === 1) return true;
  return false;
}

export async function dispatchZoningRightsAction(input: {
  admin: SupabaseClient;
  sessionId: string;
  participantId: string;
  isLead: boolean;
  action: ZoningRightsAction;
}): Promise<ZoningRightsActionResult> {
  const { admin, sessionId, participantId, isLead, action } = input;
  await expireIfNeeded(admin, sessionId);

  const zr = await loadZoningSession(admin, sessionId);
  if (!zr) return fail(404, "Zoning Rights is not started.");
  const roster = await loadRoster(admin, sessionId);
  const rounds = await loadRounds(admin, sessionId);
  const round = zr.current_round_id ? await loadRound(admin, zr.current_round_id) : null;
  if (round) await rerollDisconnected(admin, zr, round, roster, rounds);
  const liveRound = round ? (await loadRound(admin, round.id)) ?? round : null;

  if (action.type === "complete") {
    if (!isLead) return fail(403, "Only the facilitator can end the session.");
    await completeSession(admin, sessionId);
    return { ok: true };
  }

  if (action.type === "advanceRecap") {
    if (!isLead) return fail(403, "Only the facilitator can continue.");
    if (zr.phase !== "SCOREBOARD") return fail(400, "Recap is not open.");
    await poke(admin, sessionId, "SCOREBOARD", { recapAdvanced: true });
    return { ok: true };
  }

  if (action.type === "timerExpired") {
    await expireIfNeeded(admin, sessionId);
    return { ok: true };
  }

  if (!liveRound) return fail(400, "No active round.");

  if (action.type === "skipPlanner") {
    if (!isLead) return fail(403, "Only the facilitator can pick lots on their behalf.");
    if (zr.phase !== "IND_PLANNER_PICK" && zr.phase !== "TEAM_PLANNER_PICK") {
      return fail(400, "Lots are not being chosen.");
    }
    const patch: Record<string, unknown> = { planner_id: participantId };
    if (liveRound.zm_id === participantId) {
      const zm = pickNamedRole(roster, [participantId], previousZmIds(rounds, liveRound.id));
      if (!zm) return fail(400, "Need someone else to be Zoning Manager.");
      patch.zm_id = zm;
    }
    await patchRound(admin, liveRound.id, patch);
    await poke(admin, sessionId, zr.phase);
    return { ok: true };
  }

  if (action.type === "selectLots") {
    if (!canPickLots(zr, liveRound, participantId, isLead)) {
      return fail(403, "You are not choosing lots this round.");
    }
    const unique = sanitizeLotPicks(zr.board_json, action.cells, liveRound.k);
    await patchRound(admin, liveRound.id, { lots_json: unique });
    await poke(admin, sessionId, zr.phase, { selected: unique as unknown as Json });
    return { ok: true };
  }

  if (action.type === "lockLots") {
    if (!canPickLots(zr, liveRound, participantId, isLead)) {
      return fail(403, "You are not choosing lots this round.");
    }
    const fromClient = action.cells
      ? sanitizeLotPicks(zr.board_json, action.cells, liveRound.k)
      : [];
    const selected =
      fromClient.length === liveRound.k
        ? fromClient
        : lotsAreLettered(liveRound.lots_json)
          ? asLetteredLots(liveRound.lots_json).map((l) => ({ col: l.col, row: l.row }))
          : asCells(liveRound.lots_json);
    if (selected.length !== liveRound.k) {
      return fail(400, `Pick exactly ${liveRound.k} lots.`);
    }
    if (selected.some((c) => !isLegalLot(zr.board_json, c.col, c.row))) {
      return fail(400, "Those lots are not legal.");
    }
    const lettered = letterLots(selected);
    const packId = await resolvePackId(admin, sessionId);
    const dealt = await dealBuildings(admin, sessionId, packId, zr.board_json, liveRound.k);
    if (!dealt) return fail(400, "Not enough buildings left in the pack.");
    const plannerId = liveRound.planner_id;
    let zm =
      liveRound.zm_id && liveRound.zm_id !== plannerId ? liveRound.zm_id : null;
    if (!zm) {
      zm = pickNamedRole(roster, [plannerId], previousZmIds(rounds, liveRound.id));
    }
    if (!zm) return fail(400, "Need someone else to be Zoning Manager.");
    const nextPhase: ZoningRightsPhase =
      zr.mode === "team" ? "TEAM_ZM_ASSIGN" : "IND_ZM_ASSIGN";
    await patchRound(admin, liveRound.id, {
      lots_json: lettered,
      building_ids: dealt,
      zm_id: zm,
    });
    await patchSession(admin, sessionId, { phase: nextPhase });
    await poke(admin, sessionId, nextPhase);
    return { ok: true };
  }

  if (action.type === "lockZmAssignment") {
    if (zr.phase !== "IND_ZM_ASSIGN" && zr.phase !== "TEAM_ZM_ASSIGN") {
      return fail(400, "Zoning is not open.");
    }
    if (participantId !== liveRound.zm_id) {
      return fail(403, "Only the Zoning Manager can lock this.");
    }
    const allowed = new Set(liveRound.building_ids);
    const assignment = action.assignment;
    if (!assignmentComplete(assignment, liveRound.k)) {
      return fail(400, "Place every building.");
    }
    if (Object.values(assignment).some((id) => !allowed.has(id))) {
      return fail(400, "Those are not the dealt buildings.");
    }
    const now = new Date().toISOString();
    if (zr.mode === "team") {
      const ld = pickNamedRole(
        roster,
        [liveRound.zm_id, liveRound.planner_id],
        previousLdIds(rounds, liveRound.id)
      );
      if (!ld) return fail(400, "Need someone else to be Lead Developer.");
      await patchRound(admin, liveRound.id, {
        zm_assignment_json: assignment,
        lead_developer_id: ld,
        discuss_started_at: now,
      });
      await patchSession(admin, sessionId, { phase: "TEAM_DISCUSS" });
      await poke(admin, sessionId, "TEAM_DISCUSS");
      return { ok: true };
    }
    await patchRound(admin, liveRound.id, {
      zm_assignment_json: assignment,
      guess_started_at: now,
    });
    await patchSession(admin, sessionId, { phase: "IND_GUESS" });
    await poke(admin, sessionId, "IND_GUESS");
    return { ok: true };
  }

  if (action.type === "placeGuess" || action.type === "lockGuess") {
    if (zr.phase !== "IND_GUESS") return fail(400, "Guessing is not open.");
    if (participantId === liveRound.zm_id) {
      return fail(403, "The Zoning Manager does not guess.");
    }
    const existing = (await loadGuesses(admin, liveRound.id)).find(
      (g) => g.participant_id === participantId
    );
    if (existing?.locked_at) return fail(400, "You already locked in.");
    const assignment =
      action.type === "placeGuess"
        ? action.assignment
        : action.assignment && Object.keys(action.assignment).length > 0
          ? action.assignment
          : asAssignment(existing?.assignment_json ?? {});
    if (action.type === "lockGuess" && !assignmentComplete(assignment, liveRound.k)) {
      return fail(400, "Place every building before you lock in.");
    }
    const lockedAt = action.type === "lockGuess" ? new Date().toISOString() : existing?.locked_at ?? null;
    if (existing) {
      await admin
        .from("zoning_rights_guesses")
        .update({ assignment_json: assignment, locked_at: lockedAt })
        .eq("id", existing.id);
    } else {
      await admin.from("zoning_rights_guesses").insert({
        round_id: liveRound.id,
        participant_id: participantId,
        assignment_json: assignment,
        locked_at: lockedAt,
      });
    }
    if (action.type === "lockGuess") {
      const guesses = await loadGuesses(admin, liveRound.id);
      const guesserIds = roster
        .map((r) => r.participantId)
        .filter((id) => id !== liveRound.zm_id);
      const allLocked =
        guesserIds.length > 0 &&
        guesserIds.every((id) => guesses.some((g) => g.participant_id === id && g.locked_at));
      if (allLocked) {
        const fresh = await loadZoningSession(admin, sessionId);
        const freshRound = await loadRound(admin, liveRound.id);
        if (fresh && freshRound) await revealIndividual(admin, fresh, freshRound);
        return { ok: true };
      }
    }
    if (action.type === "placeGuess") return { ok: true };
    await poke(admin, sessionId, "IND_GUESS");
    return { ok: true };
  }

  if (action.type === "placeTeamGuess" || action.type === "lockTeam") {
    if (zr.phase !== "TEAM_DISCUSS" && zr.phase !== "TEAM_LOCK") {
      return fail(400, "Team placement is not open.");
    }
    if (participantId !== liveRound.lead_developer_id) {
      return fail(403, "Only the Lead Developer can place the team's choice.");
    }
    const assignment =
      action.type === "placeTeamGuess"
        ? action.assignment
        : action.assignment && Object.keys(action.assignment).length > 0
          ? action.assignment
          : asAssignment(liveRound.team_guess_json);
    await patchRound(admin, liveRound.id, { team_guess_json: assignment });
    if (action.type === "lockTeam") {
      if (!assignmentComplete(assignment, liveRound.k)) {
        return fail(400, "Place every building before you lock in.");
      }
      const fresh = await loadZoningSession(admin, sessionId);
      const freshRound = await loadRound(admin, liveRound.id);
      if (fresh && freshRound) await revealTeam(admin, fresh, freshRound);
      return { ok: true };
    }
    await poke(admin, sessionId, zr.phase, {
      teamGuess: assignment as unknown as Json,
    });
    return { ok: true };
  }

  if (action.type === "continue") {
    if (!isLead) return fail(403, "Only the facilitator can continue.");
    if (zr.phase === "TEAM_INTRO") {
      await patchSession(admin, sessionId, { phase: "TEAM_PLANNER_PICK" });
      await poke(admin, sessionId, "TEAM_PLANNER_PICK");
      return { ok: true };
    }
    if (zr.phase === "IND_REVEAL") {
      if (zr.individual_round_index < REQUIRED_INDIVIDUAL_ROUNDS) {
        if (legalLots(zr.board_json).length < IND_K) {
          return fail(400, "Not enough lots left.");
        }
        return beginIndividualRound(admin, zr, roster, rounds);
      }
      return fail(400, "Choose another round or move to team play.");
    }
    if (zr.phase === "TEAM_REVEAL") {
      if (legalLots(zr.board_json).length < TEAM_K) {
        return fail(400, "Not enough lots left.");
      }
      return beginTeamRound(admin, zr, roster, rounds, false);
    }
    return fail(400, "Nothing to continue.");
  }

  if (action.type === "anotherRound") {
    if (!isLead) return fail(403, "Only the facilitator can start another round.");
    if (zr.phase === "TEAM_REVEAL") {
      const packId = await resolvePackId(admin, sessionId);
      const leftover = await unusedBuildingIds(admin, sessionId, packId, zr.board_json);
      if (leftover.length < TEAM_K || legalLots(zr.board_json).length < TEAM_K) {
        return fail(400, "Not enough lots left.");
      }
      return beginTeamRound(admin, zr, roster, rounds, false);
    }
    if (zr.phase !== "IND_REVEAL") return fail(400, "Not on a reveal.");
    if (zr.individual_round_index < REQUIRED_INDIVIDUAL_ROUNDS) {
      return fail(400, "Finish three individual rounds first.");
    }
    const packId = await resolvePackId(admin, sessionId);
    const leftover = await unusedBuildingIds(admin, sessionId, packId, zr.board_json);
    if (leftover.length < IND_K || legalLots(zr.board_json).length < IND_K) {
      return fail(400, "Not enough lots left.");
    }
    return beginIndividualRound(admin, zr, roster, rounds);
  }

  if (action.type === "moveToTeamPlay") {
    if (!isLead) return fail(403, "Only the facilitator can move to team play.");
    if (zr.phase !== "IND_REVEAL") return fail(400, "Not on a reveal.");
    if (zr.individual_round_index < MIN_INDIVIDUAL_BEFORE_TEAM) {
      return fail(400, "Finish two individual rounds first.");
    }
    const packId = await resolvePackId(admin, sessionId);
    const leftover = await unusedBuildingIds(admin, sessionId, packId, zr.board_json);
    if (leftover.length < TEAM_K || legalLots(zr.board_json).length < TEAM_K) {
      return fail(400, "Not enough lots left for team play.");
    }
    return beginTeamRound(admin, zr, roster, rounds, true);
  }

  return fail(400, "Unknown action.");
}

export { asAssignment, asCells, asLetteredLots, displayNameMap, lotsAreLettered };
