import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
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
  syncPublicState,
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

async function poke(
  admin: SupabaseClient,
  sessionId: string,
  phase: SayLessSessionRow["phase"]
): Promise<void> {
  await syncPublicState(admin, sessionId, phase);
}

async function claimPatch(
  admin: SupabaseClient,
  sessionId: string,
  version: number,
  patch: Record<string, unknown>
): Promise<boolean> {
  const { data, error } = await admin
    .from("say_less_sessions")
    .update({ ...patch, version: version + 1 })
    .eq("session_id", sessionId)
    .eq("version", version)
    .select("session_id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

async function resetPlayRows(admin: SupabaseClient, sessionId: string): Promise<void> {
  await admin.from("say_less_turns").delete().eq("session_id", sessionId);
  await admin.from("say_less_previews").delete().eq("session_id", sessionId);
  await admin.from("say_less_teams").delete().eq("session_id", sessionId);
}

export async function resetSayLessToLobby(
  admin: SupabaseClient,
  sessionId: string
): Promise<void> {
  const existing = await loadSayLessSession(admin, sessionId);
  await resetPlayRows(admin, sessionId);
  if (!existing) return;
  await admin
    .from("say_less_sessions")
    .update({
      phase: "lobby",
      deck_card_ids: [],
      pile_card_ids: [],
      round: 1,
      first_team: "A",
      next_team: "A",
      cursor_a: 0,
      cursor_b: 0,
      current_turn_id: null,
      phase_deadline: null,
      hold_started_at: null,
      paused: false,
      last_turn_got_it: null,
      last_turn_end_reason: null,
      round_1_ended_early: false,
      round_2_ended_early: false,
      version: existing.version + 1,
    })
    .eq("session_id", sessionId);
}

export async function startSayLess(
  admin: SupabaseClient,
  sessionId: string
): Promise<SayLessActionResult> {
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
  await resetPlayRows(admin, sessionId);

  const cards = await loadActiveCards(admin, packId);
  let deck: string[];
  try {
    deck = drawDeck(cards, lobby.category_a, lobby.category_b);
  } catch (err) {
    return fail(500, err instanceof Error ? err.message : "Could not build the deck.");
  }

  const formed = splitTeams(roster.map((row) => row.participantId));
  const firstTeam: SayLessTeamLabel = Math.random() < 0.5 ? "A" : "B";
  const { error: teamErr } = await admin.from("say_less_teams").insert([
    { session_id: sessionId, label: "A", member_ids: formed.A },
    { session_id: sessionId, label: "B", member_ids: formed.B },
  ]);
  if (teamErr) return fail(500, teamErr.message);

  const claimed = await claimPatch(admin, sessionId, lobby.version, {
    phase: "teams",
    deck_card_ids: deck,
    pile_card_ids: deck,
    round: 1,
    first_team: firstTeam,
    next_team: firstTeam,
    cursor_a: 0,
    cursor_b: 0,
    current_turn_id: null,
    phase_deadline: null,
    hold_started_at: null,
    paused: false,
    last_turn_got_it: null,
    last_turn_end_reason: null,
    round_1_ended_early: false,
    round_2_ended_early: false,
  });
  if (!claimed) return fail(409, "Someone else started this session.");
  await poke(admin, sessionId, "teams");
  return { ok: true };
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
  teams: SayLessTeamRow[]
): Promise<SayLessActionResult> {
  if (row.pile_card_ids.length === 0) {
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

    const { data: turn, error: turnErr } = await admin
      .from("say_less_turns")
      .insert({
        session_id: sessionId,
        round: row.round,
        team_id: team.id,
        clue_giver_id: pick.giverId,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (turnErr || !turn) {
      return fail(500, turnErr?.message ?? "Could not start the turn.");
    }

    const claimed = await claimPatch(admin, sessionId, row.version, {
      phase: "turn",
      next_team: otherTeam(nextTeam),
      cursor_a: cursorA,
      cursor_b: cursorB,
      current_turn_id: turn.id as string,
      phase_deadline: deadlineFromNow(SAY_LESS_TURN_SECONDS),
      hold_started_at: null,
      paused: false,
    });
    if (!claimed) {
      await admin.from("say_less_turns").delete().eq("id", turn.id as string);
      return { ok: true };
    }
    await poke(admin, sessionId, "turn");
    return { ok: true };
  }

  const claimed = await claimPatch(admin, sessionId, row.version, {
    phase: "hold",
    paused: true,
    phase_deadline: null,
    hold_started_at: new Date().toISOString(),
  });
  if (!claimed) return { ok: true };
  await poke(admin, sessionId, "hold");
  return { ok: true };
}

async function closeRound(
  admin: SupabaseClient,
  sessionId: string,
  row: SayLessSessionRow,
  reason: SayLessEndReason
): Promise<SayLessActionResult & { claimed?: boolean }> {
  const nextPhase = row.round === 1 ? "round_break" : "final_scores";
  const claimed = await claimPatch(admin, sessionId, row.version, {
    phase: nextPhase,
    current_turn_id: null,
    phase_deadline: null,
    hold_started_at: null,
    paused: false,
    last_turn_end_reason: reason,
    pile_card_ids: row.round === 1 ? row.pile_card_ids : [],
    round_1_ended_early: row.round === 1 && reason === "round_ended" ? true : row.round_1_ended_early,
    round_2_ended_early: row.round === 2 && reason === "round_ended" ? true : row.round_2_ended_early,
  });
  if (!claimed) return { ok: true, claimed: false };
  await poke(admin, sessionId, nextPhase);
  return { ok: true, claimed: true };
}

type PendingCardEvent = {
  cardId: string;
  outcome: "got_it" | "pass" | "oops" | "expired";
};

async function writePendingEvent(
  admin: SupabaseClient,
  turnId: string | null,
  pending: PendingCardEvent | undefined
): Promise<void> {
  if (!turnId || !pending) return;
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { error } = await admin.from("say_less_card_events").insert({
      turn_id: turnId,
      card_id: pending.cardId,
      outcome: pending.outcome,
    });
    if (!error) return;
    lastError = error.message;
  }
  throw new Error(lastError ?? "Could not record the card.");
}

async function closeCurrentTurn(
  admin: SupabaseClient,
  turnId: string | null,
  reason: SayLessEndReason
): Promise<void> {
  if (!turnId) return;
  const { error } = await admin
    .from("say_less_turns")
    .update({ ended_at: new Date().toISOString(), end_reason: reason })
    .eq("id", turnId)
    .is("ended_at", null);
  if (error) throw new Error(error.message);
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
    const closed = await closeRound(
      admin,
      sessionId,
      { ...row, pile_card_ids: pile },
      reason === "pile_empty" ? "pile_empty" : reason
    );
    if (!closed.ok) return closed;
    if (!closed.claimed) return { ok: true };
    try {
      await closeCurrentTurn(admin, row.current_turn_id, reason);
      await writePendingEvent(admin, row.current_turn_id, pending);
    } catch {
      /* public phase already moved */
    }
    return { ok: true };
  }

  const pause = shouldPauseAfterTurns(counted);
  const now = new Date().toISOString();
  const claimed = await claimPatch(admin, sessionId, row.version, {
    phase: "hold",
    pile_card_ids: pile,
    current_turn_id: null,
    phase_deadline: pause ? null : deadlineFromNow(SAY_LESS_HOLD_SECONDS),
    hold_started_at: now,
    paused: pause,
    last_turn_got_it: gotIt,
    last_turn_end_reason: reason,
  });
  if (!claimed) return { ok: true };
  await poke(admin, sessionId, "hold");
  try {
    await closeCurrentTurn(admin, row.current_turn_id, reason);
    await writePendingEvent(admin, row.current_turn_id, pending);
  } catch {
    /* public phase already moved */
  }
  return { ok: true };
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
      await poke(admin, sessionId, "ready");
      continue;
    }

    if (row.phase === "turn") {
      const { pile, pending } = pendingTopCard(row, "expired");
      const result = await finishTurn(admin, sessionId, row, "timer", pile, pending);
      if (!result.ok) continue;
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
    if (!claimed) return { ok: true };
    await poke(admin, sessionId, "lobby");
    return { ok: true };
  }

  const row = await loadSayLessSession(admin, sessionId);
  if (!row) return fail(404, "Say Less has not started.");
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
      const claimed = await claimPatch(admin, sessionId, row.version, {});
      if (!claimed) return fail(409, "Teams just changed. Try that switch again.");
      for (const label of ["A", "B"] as const) {
        const team = teams.find((item) => item.label === label);
        if (!team) continue;
        const { error } = await admin
          .from("say_less_teams")
          .update({ member_ids: moved.teams[label] })
          .eq("id", team.id);
        if (error) return fail(500, error.message);
      }
      await poke(admin, sessionId, "teams");
      return { ok: true };
    }
    case "confirmTeams": {
      if (!isLead) return fail(403, "Only the facilitator can confirm teams.");
      if (row.phase !== "teams") return fail(409, "Teams are already confirmed.");
      const roster = await loadRoster(admin, sessionId);
      const playerIds = roster.map((member) => member.participantId);
      for (const team of teams) {
        const shuffled = shuffleCopy(team.member_ids);
        const { error } = await admin
          .from("say_less_teams")
          .update({ member_ids: shuffled })
          .eq("id", team.id);
        if (error) return fail(500, error.message);
      }
      const dealt = dealPreviews(row.deck_card_ids, playerIds);
      const previewRows = playerIds.map((id) => ({
        session_id: sessionId,
        participant_id: id,
        card_ids: dealt[id] ?? [row.deck_card_ids[0], row.deck_card_ids[1]],
      }));
      await admin.from("say_less_previews").delete().eq("session_id", sessionId);
      const { error: previewErr } = await admin.from("say_less_previews").insert(previewRows);
      if (previewErr) return fail(500, previewErr.message);
      const claimed = await claimPatch(admin, sessionId, row.version, {
        phase: "preview",
        phase_deadline: deadlineFromNow(SAY_LESS_PREVIEW_SECONDS),
        paused: false,
      });
      if (!claimed) return { ok: true };
      await poke(admin, sessionId, "preview");
      return { ok: true };
    }
    case "startRound": {
      if (!isLead) return fail(403, "Only the facilitator can start the round.");
      if (row.phase === "ready") {
        return beginTurn(admin, sessionId, row, teams);
      }
      if (row.phase === "round_break") {
        const pile = shuffleCopy(row.deck_card_ids);
        const claimed = await claimPatch(admin, sessionId, row.version, {
          round: 2,
          pile_card_ids: pile,
          last_turn_got_it: null,
          last_turn_end_reason: null,
        });
        if (!claimed) return { ok: true };
        const next = await loadSayLessSession(admin, sessionId);
        if (!next) return fail(500, "Could not start round 2.");
        return beginTurn(admin, sessionId, next, teams);
      }
      return fail(409, "Not time to start a round.");
    }
    case "cardAction": {
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
        return { ok: true };
      }
      const pile = applyPileOutcome(row.pile_card_ids, action.outcome);
      const pending: PendingCardEvent = { cardId: top, outcome: action.outcome };
      if (pile.length === 0) {
        return finishTurn(admin, sessionId, row, "pile_empty", pile, pending);
      }
      const claimed = await claimPatch(admin, sessionId, row.version, {
        pile_card_ids: pile,
      });
      if (!claimed) return { ok: true };
      await poke(admin, sessionId, "turn");
      try {
        await writePendingEvent(admin, turn.id, pending);
      } catch {
        /* pile already moved */
      }
      return { ok: true };
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
      if (!claimed) return { ok: true };
      await poke(admin, sessionId, "hold");
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
      if (!claimed) return { ok: true };
      await poke(admin, sessionId, "hold");
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
      const { error } = await admin
        .from("sessions")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
      if (error) return fail(500, error.message);
      await poke(admin, sessionId, "final_scores");
      return { ok: true };
    }
    default:
      return fail(400, "Unknown action.");
  }
}

export { displayNameMap };
