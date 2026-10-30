import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadLifecycle } from "@/lib/session/lifecycle";
import type { Json } from "@/lib/types/database";
import {
  SAY_LESS_HOLD_SECONDS,
  SAY_LESS_MAX_PLAYERS,
  SAY_LESS_MIN_PLAYERS,
  SAY_LESS_PREVIEW_SECONDS,
  SAY_LESS_TURN_SECONDS,
  applyPileOutcome,
  deadlineFromNow,
  deadlinePassed,
  dealPreviews,
  drawDeck,
  SAY_LESS_PASS_BLOCKED_ROUND_1,
  canPassInRound,
  isCategoryId,
  otherTeam,
  pickClueGiver,
  shouldPauseAfterTurns,
  shuffleCopy,
  splitTeams,
  swapPlayers,
  type SayLessCategoryId,
  type SayLessEndReason,
  type SayLessTeamLabel,
} from "./engine";
import {
  connectedMap,
  displayNameMap,
  ensureLobbyRow,
  loadActiveCards,
  loadEventsForTurns,
  loadRoster,
  loadSayLessSession,
  loadTeams,
  loadTurn,
  loadTurns,
  resolvePackId,
  type SayLessSessionRow,
  type SayLessTeamRow,
} from "./store";
import type { SayLessAction } from "./types";

type ActionOk = { ok: true };
type ActionErr = { ok: false; status: number; error: string };
export type SayLessActionResult = ActionOk | ActionErr;

function fail(status: number, error: string): ActionErr {
  return { ok: false, status, error };
}

async function commitSetup(
  admin: SupabaseClient, sessionId: string, row: SayLessSessionRow,
  patch: Record<string, unknown>, teams: { id: string; memberIds: string[] }[] | null = null,
  previews: { participantId: string; cardIds: string[] }[] | null = null,
  turn: { teamId: string; giverId: string; startedAt: string } | null = null
): Promise<SayLessActionResult> {
  const { data, error } = await admin.rpc("commit_say_less_setup", {
    p_session_id: sessionId, p_expected_version: row.version, p_expected_phase: row.phase,
    p_patch: patch, p_teams: teams, p_previews: previews, p_turn: turn,
  });
  if (error) return fail(500, error.message);
  return data === true ? { ok: true } : fail(409, "The workshop just changed. Refresh and try again.");
}

async function claimPatch(admin: SupabaseClient, sessionId: string, version: number, patch: Record<string, unknown>): Promise<boolean> {
  const row = await loadSayLessSession(admin, sessionId);
  if (!row || row.version !== version) return false;
  const result = await commitSetup(admin, sessionId, row, patch);
  if (!result.ok && result.status !== 409) throw new Error(result.error);
  return result.ok;
}

export async function resetSayLessToLobby(admin: SupabaseClient, sessionId: string): Promise<void> {
  const lifecycle = await loadLifecycle(admin, sessionId);
  const { data, error } = await admin.rpc("reset_workshop_session", {
    p_session_id: sessionId, p_expected_version: lifecycle.lifecycle_version,
  });
  if (error || data !== true) throw new Error(error?.message ?? "The workshop changed. Refresh before resetting.");
}

export async function startSayLess(
  admin: SupabaseClient,
  sessionId: string, expectedVersion?: number
): Promise<SayLessActionResult> {
  const lifecycle = await loadLifecycle(admin, sessionId);
  if (lifecycle.status !== "lobby") return fail(409, "This workshop has already started or ended.");
  const roster = await loadRoster(admin, sessionId);
  if (roster.length < SAY_LESS_MIN_PLAYERS) {
    return fail(400, "Say Less needs at least 4 people in the room.");
  }
  if (roster.length > SAY_LESS_MAX_PLAYERS) {
    return fail(400, "Say Less holds 14 people at most.");
  }

  const packId = await resolvePackId(admin, sessionId);
  const lobby = await ensureLobbyRow(admin, sessionId);
  if (
    !isCategoryId(lobby.category_a) ||
    !isCategoryId(lobby.category_b) ||
    lobby.category_a === lobby.category_b
  ) {
    return fail(400, "Pick two different categories before starting.");
  }

  const cards = await loadActiveCards(admin, packId);
  let deck: string[];
  try {
    deck = drawDeck(cards, lobby.category_a, lobby.category_b);
  } catch (err) {
    return fail(500, err instanceof Error ? err.message : "Could not build the deck.");
  }

  const formed = splitTeams(roster.map((row) => row.participantId));
  const firstTeam: SayLessTeamLabel = Math.random() < 0.5 ? "A" : "B";
  const { data, error } = await admin.rpc("start_workshop_session", {
    p_session_id: sessionId, p_protocol: "say-less",
    p_expected_version: expectedVersion ?? lifecycle.lifecycle_version,
    p_init: { version: lobby.version, deck, teamA: formed.A, teamB: formed.B, firstTeam },
  });
  if (error) return fail(500, error.message);
  return data === true ? { ok: true } : fail(409, "The workshop changed before Start. Refresh and try again.");
}

async function countedTurnsThisRound(
  admin: SupabaseClient,
  sessionId: string,
  round: 1 | 2
): Promise<number> {
  const turns = await loadTurns(admin, sessionId);
  return turns.filter((turn) => turn.round === round && turn.started_at && turn.ended_at).length;
}

async function gotItThisTurn(admin: SupabaseClient, turnId: string): Promise<number> {
  const events = await loadEventsForTurns(admin, [turnId]);
  return events.filter((event) => event.outcome === "got_it").length;
}

async function beginTurn(
  admin: SupabaseClient,
  sessionId: string,
  row: SayLessSessionRow,
  teams: SayLessTeamRow[], roundPatch: Partial<SayLessSessionRow> = {}
): Promise<SayLessActionResult> {
  const nextRow = { ...row, ...roundPatch };
  if (nextRow.pile_card_ids.length === 0) {
    return closeRound(admin, sessionId, row, "pile_empty");
  }

  const roster = await loadRoster(admin, sessionId);
  const connected = connectedMap(roster);
  let nextTeam = row.next_team;
  let cursorA = row.cursor_a;
  let cursorB = row.cursor_b;

  for (let attempt = 0; attempt < 2; attempt++) {
    const team = teams.find((item) => item.label === nextTeam);
    if (!team) return fail(500, "Team is missing.");
    const cursor = nextTeam === "A" ? cursorA : cursorB;
    const pick = pickClueGiver(team.member_ids, cursor, connected);
    if (!pick.giverId) {
      nextTeam = otherTeam(nextTeam);
      continue;
    }
    if (nextTeam === "A") cursorA = pick.nextCursor;
    else cursorB = pick.nextCursor;

    const startedAt = new Date().toISOString();
    return commitSetup(admin, sessionId, row, {
      ...roundPatch, phase: "turn", next_team: otherTeam(nextTeam), cursor_a: cursorA, cursor_b: cursorB,
      phase_deadline: deadlineFromNow(SAY_LESS_TURN_SECONDS), hold_started_at: null, paused: false,
    }, null, null, { teamId: team.id, giverId: pick.giverId, startedAt });
  }

  return commitSetup(admin, sessionId, row, { ...roundPatch, phase: "hold", paused: true,
    phase_deadline: null, hold_started_at: new Date().toISOString() });
}

function roundClosePatch(
  row: SayLessSessionRow,
  reason: SayLessEndReason
): Record<string, Json> {
  return {
    phase: row.round === 1 ? "round_break" : "final_scores",
    current_turn_id: null, phase_deadline: null, hold_started_at: null, paused: false,
    last_turn_end_reason: reason,
    pile_card_ids: row.round === 1 ? row.pile_card_ids : [],
    round_1_ended_early: row.round === 1 && reason === "round_ended" ? true : row.round_1_ended_early,
    round_2_ended_early: row.round === 2 && reason === "round_ended" ? true : row.round_2_ended_early,
  };
}

type PendingCardEvent = {
  cardId: string;
  outcome: "got_it" | "pass" | "oops" | "expired";
  operationId?: string;
  expectedVersion?: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The event is the durable receipt. It is written in the same RPC as the pile
 * and score, so a response lost after commit can be retried after refresh.
 */
async function replayCardInput(
  admin: SupabaseClient, sessionId: string, participantId: string,
  action: Extract<SayLessAction, { type: "cardAction" }>
): Promise<SayLessActionResult | null> {
  if (action.operationId === undefined) return null; // Older clients remain supported.
  if (typeof action.operationId !== "string" || !UUID.test(action.operationId) ||
    typeof action.turnId !== "string" || !UUID.test(action.turnId) ||
    !Number.isInteger(action.expectedVersion) || (action.expectedVersion ?? -1) < 0) {
    return fail(400, "Invalid saved card input.");
  }
  const turn = await loadTurn(admin, action.turnId);
  if (!turn || turn.session_id !== sessionId || turn.clue_giver_id !== participantId) {
    return fail(403, "This saved input does not belong to your turn.");
  }
  const { data, error } = await admin.from("say_less_card_events")
    .select("turn_id, card_id, outcome, operation_version").eq("operation_id", action.operationId).maybeSingle();
  if (error) return fail(500, error.message);
  if (!data) return null;
  return data.turn_id === action.turnId && data.card_id === action.cardId &&
    data.outcome === action.outcome && data.operation_version === action.expectedVersion
    ? { ok: true } : fail(409, "This saved input conflicts with a previously accepted action.");
}

async function commitTurnPatch(
  admin: SupabaseClient,
  sessionId: string,
  row: SayLessSessionRow,
  patch: Record<string, Json>,
  pending?: PendingCardEvent,
  endReason?: SayLessEndReason
): Promise<SayLessActionResult> {
  const { data, error } = await admin.rpc("commit_say_less_turn", {
    p_session_id: sessionId, p_expected_version: row.version,
    p_turn_id: row.current_turn_id, p_patch: patch,
    p_event: pending ?? null, p_end_reason: endReason ?? null,
  });
  if (error) return fail(500, error.message);
  if (data !== true) return fail(409, "The turn just changed. Refresh and try again.");
  return { ok: true };
}

async function closeRound(
  admin: SupabaseClient,
  sessionId: string,
  row: SayLessSessionRow,
  reason: SayLessEndReason
): Promise<SayLessActionResult> {
  return commitTurnPatch(admin, sessionId, row, roundClosePatch(row, reason));
}

async function finishTurn(
  admin: SupabaseClient,
  sessionId: string,
  row: SayLessSessionRow,
  reason: SayLessEndReason,
  pile: string[],
  pending?: PendingCardEvent
): Promise<SayLessActionResult> {
  const priorEnded = await countedTurnsThisRound(admin, sessionId, row.round);
  const counted = row.current_turn_id ? priorEnded + 1 : priorEnded;
  const existingGotIt = row.current_turn_id ? await gotItThisTurn(admin, row.current_turn_id) : 0;
  const gotIt = existingGotIt + (pending?.outcome === "got_it" ? 1 : 0);
  const empty = pile.length === 0 || reason === "pile_empty";
  if (empty) {
    return commitTurnPatch(admin, sessionId, row,
      roundClosePatch({ ...row, pile_card_ids: pile }, reason), pending, reason);
  }
  const pause = shouldPauseAfterTurns(counted);
  return commitTurnPatch(admin, sessionId, row, {
    phase: "hold", pile_card_ids: pile, current_turn_id: null,
    phase_deadline: pause ? null : deadlineFromNow(SAY_LESS_HOLD_SECONDS),
    hold_started_at: new Date().toISOString(), paused: pause,
    last_turn_got_it: gotIt, last_turn_end_reason: reason,
  }, pending, reason);
}

function pendingTopCard(
  row: SayLessSessionRow,
  outcome: PendingCardEvent["outcome"]
): { pile: string[]; pending: PendingCardEvent | undefined } {
  const pile = applyPileOutcome(row.pile_card_ids, outcome);
  const top = row.pile_card_ids[0];
  return {
    pile,
    pending: top ? { cardId: top, outcome } : undefined,
  };
}

export async function advanceIfDue(
  admin: SupabaseClient,
  sessionId: string
): Promise<void> {
  for (let step = 0; step < 40; step++) {
    const row = await loadSayLessSession(admin, sessionId);
    if (!row) return;
    const now = Date.now();
    const due = !row.paused && deadlinePassed(row.phase_deadline, now);
    if (!due) return;

    if (row.phase === "preview") {
      const claimed = await claimPatch(admin, sessionId, row.version, {
        phase: "ready",
        phase_deadline: null,
      });
      if (!claimed) continue;

      continue;
    }

    if (row.phase === "turn") {
      const { pile, pending } = pendingTopCard(row, "expired");
      const result = await finishTurn(admin, sessionId, row, "timer", pile, pending);
      if (!result.ok && result.status !== 409) throw new Error(result.error);
      continue;
    }

    if (row.phase === "hold") {
      const teams = await loadTeams(admin, sessionId);
      const result = await beginTurn(admin, sessionId, row, teams);
      if (!result.ok) continue;
      continue;
    }

    return;
  }
}

export async function dispatchSayLessAction(input: {
  admin: SupabaseClient;
  sessionId: string;
  participantId: string;
  isLead: boolean;
  action: SayLessAction;
}): Promise<SayLessActionResult> {
  const { admin, sessionId, participantId, isLead, action } = input;
  if (action.type === "cardAction") {
    const replay = await replayCardInput(admin, sessionId, participantId, action);
    if (replay) return replay;
  }
  await advanceIfDue(admin, sessionId);

  if (action.type === "setCategories") {
    if (!isLead) return fail(403, "Only the facilitator can pick the packs.");
    const [a, b] = action.categories;
    if (!isCategoryId(a) || !isCategoryId(b) || a === b) {
      return fail(400, "Pick two different categories.");
    }
    const row = await ensureLobbyRow(admin, sessionId);
    if (row.phase !== "lobby") return fail(409, "Packs are locked after Start.");
    const claimed = await claimPatch(admin, sessionId, row.version, {
      category_a: a,
      category_b: b,
    });
    if (!claimed) return fail(409, "The workshop changed before this control was accepted.");

    return { ok: true };
  }

  const row = await loadSayLessSession(admin, sessionId);
  if (!row) return fail(404, "Say Less has not started.");
  if (action.type !== "cardAction" && action.type !== "advance" && action.expectedVersion !== undefined &&
    (action.expectedVersion !== row.version || action.turnId !== row.current_turn_id)) {
    return fail(409, "This control belongs to an earlier turn. Check the current workshop.");
  }
  const teams = await loadTeams(admin, sessionId);

  switch (action.type) {
    case "advance":
      return { ok: true };
    case "swapPlayers": {
      if (!isLead) return fail(403, "Only the facilitator can switch people.");
      if (row.phase !== "teams") return fail(409, "Teams are locked.");
      if (typeof action.a !== "string" || typeof action.b !== "string") {
        return fail(400, "Pick two people.");
      }
      const current = {
        A: teams.find((team) => team.label === "A")?.member_ids ?? [],
        B: teams.find((team) => team.label === "B")?.member_ids ?? [],
      };
      const moved = swapPlayers(current, action.a, action.b);
      if (!moved.ok) return fail(400, moved.error);
      return commitSetup(admin, sessionId, row, {}, teams.map(team => ({ id: team.id,
        memberIds: moved.teams[team.label] })));
    }
    case "confirmTeams": {
      if (!isLead) return fail(403, "Only the facilitator can confirm teams.");
      if (row.phase !== "teams") return fail(409, "Teams are already confirmed.");
      const roster = await loadRoster(admin, sessionId);
      const playerIds = roster.map((member) => member.participantId);
      const dealt = dealPreviews(row.deck_card_ids, playerIds);
      return commitSetup(admin, sessionId, row, { phase: "preview",
        phase_deadline: deadlineFromNow(SAY_LESS_PREVIEW_SECONDS), paused: false },
        teams.map(team => ({ id: team.id, memberIds: shuffleCopy(team.member_ids) })),
        playerIds.map(id => ({ participantId: id, cardIds: dealt[id] ?? [row.deck_card_ids[0], row.deck_card_ids[1]] })));
    }
    case "startRound": {
      if (!isLead) return fail(403, "Only the facilitator can start the round.");
      if (row.phase === "ready") {
        return beginTurn(admin, sessionId, row, teams);
      }
      if (row.phase === "round_break") {
        const pile = shuffleCopy(row.deck_card_ids);
        return beginTurn(admin, sessionId, row, teams, { round: 2, pile_card_ids: pile,
          last_turn_got_it: null, last_turn_end_reason: null });
      }
      return fail(409, "Not time to start a round.");
    }
    case "cardAction": {
      if (action.operationId !== undefined &&
        (action.turnId !== row.current_turn_id || action.expectedVersion !== row.version)) {
        // A duplicate can commit after the initial receipt lookup but before
        // this session read. Recheck its exact receipt before rejecting it.
        const replay = await replayCardInput(admin, sessionId, participantId, action);
        return replay ?? fail(409, "The turn changed before this saved card input was accepted. Check the current card.");
      }
      if (row.phase !== "turn" || !row.current_turn_id) {
        return fail(409, "No card is in play.");
      }
      const turn = await loadTurn(admin, row.current_turn_id);
      if (!turn) return fail(404, "Turn is missing.");
      if (turn.clue_giver_id !== participantId) {
        return fail(403, "Only the clue-giver can mark the card.");
      }
      if (action.outcome !== "got_it" && action.outcome !== "pass") {
        return fail(400, "Unknown card action.");
      }
      if (action.outcome === "pass" && !canPassInRound(row.round)) {
        return fail(400, SAY_LESS_PASS_BLOCKED_ROUND_1);
      }
      const top = row.pile_card_ids[0];
      if (!top || top !== action.cardId) {
        return fail(409, "That card is no longer on top.");
      }
      if (deadlinePassed(row.phase_deadline, Date.now())) {
        await advanceIfDue(admin, sessionId);
        return fail(409, "Time is up. This card input was not accepted.");
      }
      const pile = applyPileOutcome(row.pile_card_ids, action.outcome);
      const pending: PendingCardEvent = { cardId: top, outcome: action.outcome,
        ...(action.operationId ? { operationId: action.operationId, expectedVersion: action.expectedVersion } : {}) };
      if (pile.length === 0) {
        return finishTurn(admin, sessionId, row, "pile_empty", pile, pending);
      }
      return commitTurnPatch(admin, sessionId, row, { pile_card_ids: pile }, pending);
    }
    case "skipTurn": {
      if (row.phase !== "turn" || !row.current_turn_id) {
        return fail(409, "No turn to skip.");
      }
      const turn = await loadTurn(admin, row.current_turn_id);
      if (!turn) return fail(404, "Turn is missing.");
      if (!isLead && turn.clue_giver_id !== participantId) {
        return fail(403, "Only the clue-giver or facilitator can skip.");
      }
      const { pile, pending } = pendingTopCard(row, "expired");
      return finishTurn(admin, sessionId, row, "skipped", pile, pending);
    }
    case "pauseHold": {
      if (!isLead) return fail(403, "Only the facilitator can pause.");
      if (row.phase !== "hold") return fail(409, "Nothing to pause.");
      const claimed = await claimPatch(admin, sessionId, row.version, {
        paused: true,
        phase_deadline: null,
      });
      if (!claimed) return fail(409, "The workshop changed before this control was accepted.");

      return { ok: true };
    }
    case "resumeHold": {
      if (!isLead) return fail(403, "Only the facilitator can resume.");
      if (row.phase !== "hold") return fail(409, "Nothing to resume.");
      const claimed = await claimPatch(admin, sessionId, row.version, {
        paused: false,
        phase_deadline: deadlineFromNow(SAY_LESS_HOLD_SECONDS),
        hold_started_at: new Date().toISOString(),
      });
      if (!claimed) return fail(409, "The workshop changed before this control was accepted.");

      return { ok: true };
    }
    case "endRound": {
      if (!isLead) return fail(403, "Only the facilitator can end the round.");
      if (row.phase !== "hold") return fail(409, "End the round from the hold.");
      return closeRound(admin, sessionId, row, "round_ended");
    }
    case "complete": {
      if (!isLead) return fail(403, "Only the facilitator can end the session.");
      if (row.phase !== "final_scores") return fail(409, "Finish scoring first.");
      const { data, error } = await admin.rpc("complete_say_less_session", {
        p_session_id: sessionId, p_expected_version: row.version,
      });
      if (error) return fail(500, error.message);
      return data === true ? { ok: true } : fail(409, "The workshop changed before completion.");
    }
    default:
      return fail(400, "Unknown action.");
  }
}

export { displayNameMap };
