import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  TALK_TRACK_HOLD_SECONDS,
  TALK_TRACK_MANDATORY_CYCLES,
  TALK_TRACK_MIN_PLAYERS,
  formTeams,
  holdIsReady,
  liveMemberIds,
  isDemoTurn,
  pickGuesser,
  shuffleCopy,
  slotPoints,
  starterIndex,
  timerHasExpired,
} from "./engine";
import {
  connectedMap,
  loadTalkTrackSession,
  loadTeams,
  loadTurn,
  loadWordResults,
  loadRoster,
  remainingPlayableCards,
  resolvePackId,
  syncPublicState,
  type RosterMember,
  type TalkTrackSessionRow,
  type TalkTrackTeamRow,
  type TalkTrackTurnRow,
} from "./store";
import type { TalkTrackAction, TalkTrackEndReason } from "./types";

type ActionOk = { ok: true };
type ActionErr = { ok: false; status: number; error: string };
export type TalkTrackActionResult = ActionOk | ActionErr;

function fail(status: number, error: string): ActionErr {
  return { ok: false, status, error };
}

async function patchSession(
  admin: SupabaseClient,
  sessionId: string,
  patch: Partial<TalkTrackSessionRow>
): Promise<void> {
  const { error } = await admin
    .from("talk_track_sessions")
    .update(patch)
    .eq("session_id", sessionId);
  if (error) throw new Error(error.message);
}

async function poke(
  admin: SupabaseClient,
  sessionId: string,
  phase: TalkTrackSessionRow["phase"]
): Promise<void> {
  await syncPublicState(admin, sessionId, phase);
}

/**
 * First writer wins on hold auto-advance. Other phones get a no-op so four
 * timers cannot all call beginTurn / afterHold.
 */
async function claimHoldAdvance(
  admin: SupabaseClient,
  sessionId: string,
  phase: TalkTrackSessionRow["phase"],
  holdStartedAt: string | null
): Promise<boolean> {
  let query = admin
    .from("talk_track_sessions")
    .update({ hold_started_at: new Date().toISOString() })
    .eq("session_id", sessionId)
    .eq("phase", phase)
    .eq("paused", false);
  query =
    holdStartedAt === null
      ? query.is("hold_started_at", null)
      : query.eq("hold_started_at", holdStartedAt);
  const { data, error } = await query.select("session_id").maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function startTalkTrack(
  admin: SupabaseClient,
  sessionId: string
): Promise<TalkTrackActionResult> {
  const roster = await loadRoster(admin, sessionId);
  if (roster.length < TALK_TRACK_MIN_PLAYERS) {
    return fail(400, "Talk Track needs at least 4 people in the room.");
  }

  await resolvePackId(admin, sessionId);

  // Always re-form. Leftover team_reveal rows from an aborted Start must not
  // make a second Start a silent no-op.
  await resetTalkTrackToLobby(admin, sessionId);

  const formed = formTeams(roster.map((r) => r.participantId));
  const teamRows = formed.map((team, index) => ({
    session_id: sessionId,
    name: team.name,
    member_ids: team.memberIds,
    score: 0,
    sort_index: index,
  }));

  const { error: sessErr } = await admin.from("talk_track_sessions").insert({
    session_id: sessionId,
    phase: "team_reveal",
    cycle_index: 1,
    team_order: [],
    next_team_index: 0,
    current_turn_id: null,
    paused: false,
    hold_started_at: new Date().toISOString(),
    last_turn_points: null,
    last_turn_end_reason: null,
  });
  if (sessErr) return fail(500, sessErr.message);

  const { data: inserted, error: teamErr } = await admin
    .from("talk_track_teams")
    .insert(teamRows)
    .select("id");
  if (teamErr) {
    await admin.from("talk_track_sessions").delete().eq("session_id", sessionId);
    return fail(500, teamErr.message);
  }

  const teamOrder = shuffleCopy((inserted ?? []).map((row) => row.id as string));
  await patchSession(admin, sessionId, { team_order: teamOrder });

  const tt = await loadTalkTrackSession(admin, sessionId);
  const teams = await loadTeams(admin, sessionId);
  if (!tt) return fail(500, "Talk Track session did not save.");
  return beginDemo(admin, sessionId, tt, teams, roster);
}

export async function resetTalkTrackToLobby(
  admin: SupabaseClient,
  sessionId: string
): Promise<void> {
  await admin.from("talk_track_score_nudges").delete().eq("session_id", sessionId);
  await admin.from("talk_track_turns").delete().eq("session_id", sessionId);
  await admin.from("talk_track_teams").delete().eq("session_id", sessionId);
  await admin.from("talk_track_sessions").delete().eq("session_id", sessionId);
}

async function beginDemo(
  admin: SupabaseClient,
  sessionId: string,
  tt: TalkTrackSessionRow,
  teams: TalkTrackTeamRow[],
  roster: RosterMember[]
): Promise<TalkTrackActionResult> {
  const lead = roster.find((row) => row.isLead);
  if (!lead) return fail(500, "The facilitator is not on the roster.");
  const trainIds = shuffleCopy(
    roster
      .filter((row) => row.participantId !== lead.participantId)
      .map((row) => row.participantId)
  ).slice(0, 3);
  if (trainIds.length < 3) {
    return fail(400, "Talk Track needs at least 4 people for the practice round.");
  }
  const teamId = tt.team_order[0] ?? teams[0]?.id;
  if (!teamId) return fail(500, "No team to attach the practice round to.");

  const { data: turn, error: turnErr } = await admin
    .from("talk_track_turns")
    .insert({
      session_id: sessionId,
      team_id: teamId,
      cycle_index: tt.cycle_index,
      card_id: null,
      guesser_id: lead.participantId,
      train_ids: trainIds,
      current_slot: 1,
      subphase: "cluing",
      started_at: new Date().toISOString(),
      ended_at: null,
      end_reason: null,
    })
    .select("id")
    .single();
  if (turnErr || !turn) {
    return fail(500, turnErr?.message ?? "Could not start the practice round.");
  }

  const slots = [1, 2, 3, 4, 5].map((slot) => ({
    turn_id: turn.id as string,
    slot,
    outcome: "unset",
  }));
  const { error: wordErr } = await admin.from("talk_track_word_results").insert(slots);
  if (wordErr) return fail(500, wordErr.message);

  await patchSession(admin, sessionId, {
    phase: "turn",
    current_turn_id: turn.id as string,
    hold_started_at: null,
    next_team_index: 0,
    paused: false,
  });
  await poke(admin, sessionId, "turn");
  return { ok: true };
}

async function beginTurn(
  admin: SupabaseClient,
  sessionId: string,
  tt: TalkTrackSessionRow,
  teams: TalkTrackTeamRow[]
): Promise<TalkTrackActionResult> {
  const order = tt.team_order;
  if (tt.next_team_index >= order.length) {
    return fail(409, "No team is waiting for a turn.");
  }

  const teamId = order[tt.next_team_index];
  const team = teams.find((t) => t.id === teamId);
  if (!team) return fail(500, "Team is missing.");

  const roster = await loadRoster(admin, sessionId);
  const live = liveMemberIds(team.member_ids, connectedMap(roster));

  if (live.length < TALK_TRACK_MIN_PLAYERS) {
    const { data: skipped, error: skipErr } = await admin
      .from("talk_track_turns")
      .insert({
        session_id: sessionId,
        team_id: team.id,
        cycle_index: tt.cycle_index,
        card_id: null,
        guesser_id: null,
        train_ids: [],
        current_slot: 1,
        subphase: "cluing",
        started_at: null,
        ended_at: new Date().toISOString(),
        end_reason: "skipped",
      })
      .select("id")
      .single();
    if (skipErr) return fail(500, skipErr.message);
    await patchSession(admin, sessionId, {
      phase: "hold",
      current_turn_id: skipped?.id ?? null,
      next_team_index: tt.next_team_index + 1,
      hold_started_at: new Date().toISOString(),
      last_turn_points: 0,
      last_turn_end_reason: "skipped",
      paused: false,
    });
    await poke(admin, sessionId, "hold");
    return { ok: true };
  }

  const packId = await resolvePackId(admin, sessionId);
  const { data: usedRows, error: usedErr } = await admin
    .from("talk_track_turns")
    .select("card_id")
    .eq("session_id", sessionId)
    .not("card_id", "is", null);
  if (usedErr) return fail(500, usedErr.message);
  const used = new Set((usedRows ?? []).map((r) => r.card_id as string));

  const { data: cards, error: cardErr } = await admin
    .from("talk_track_cards")
    .select("id")
    .eq("content_pack_id", packId)
    .eq("active", true);
  if (cardErr) return fail(500, cardErr.message);

  const unused = shuffleCopy((cards ?? []).map((c) => c.id as string)).filter(
    (id) => !used.has(id)
  );
  const cardId = unused[0];
  if (!cardId) {
    await patchSession(admin, sessionId, {
      phase: "final_scores",
      current_turn_id: null,
      hold_started_at: null,
      paused: false,
    });
    await poke(admin, sessionId, "final_scores");
    return { ok: true };
  }

  const { data: priorTurns, error: priorErr } = await admin
    .from("talk_track_turns")
    .select("guesser_id")
    .eq("session_id", sessionId)
    .eq("team_id", team.id)
    .not("guesser_id", "is", null)
    .not("card_id", "is", null);
  if (priorErr) return fail(500, priorErr.message);
  const priorGuessers = (priorTurns ?? [])
    .map((t) => t.guesser_id as string | null)
    .filter((id): id is string => Boolean(id));

  const guesserId = pickGuesser(live, priorGuessers);
  const trainIds = shuffleCopy(live.filter((id) => id !== guesserId));

  const { data: turn, error: turnErr } = await admin
    .from("talk_track_turns")
    .insert({
      session_id: sessionId,
      team_id: team.id,
      cycle_index: tt.cycle_index,
      card_id: cardId,
      guesser_id: guesserId,
      train_ids: trainIds,
      current_slot: 1,
      subphase: "cluing",
      started_at: new Date().toISOString(),
      ended_at: null,
      end_reason: null,
    })
    .select("id")
    .single();
  if (turnErr || !turn) return fail(500, turnErr?.message ?? "Could not start the turn.");

  const slots = [1, 2, 3, 4, 5].map((slot) => ({
    turn_id: turn.id as string,
    slot,
    outcome: "unset",
  }));
  const { error: wordErr } = await admin.from("talk_track_word_results").insert(slots);
  if (wordErr) return fail(500, wordErr.message);

  await patchSession(admin, sessionId, {
    phase: "turn",
    current_turn_id: turn.id as string,
    hold_started_at: null,
    paused: false,
  });
  await poke(admin, sessionId, "turn");
  return { ok: true };
}

async function finishTurn(
  admin: SupabaseClient,
  sessionId: string,
  tt: TalkTrackSessionRow,
  turn: TalkTrackTurnRow,
  reason: TalkTrackEndReason,
  team: TalkTrackTeamRow
): Promise<TalkTrackActionResult> {
  if (turn.ended_at) return { ok: true };

  const words = await loadWordResults(admin, turn.id);
  if (reason === "timer" || reason === "abandoned") {
    for (const word of words) {
      if (word.outcome === "unset") {
        await admin
          .from("talk_track_word_results")
          .update({
            outcome: "expired",
            decided_at: new Date().toISOString(),
          })
          .eq("id", word.id)
          .eq("outcome", "unset");
      }
    }
  }

  const fresh = await loadWordResults(admin, turn.id);
  const turnPoints = fresh.reduce(
    (sum, word) => (word.outcome === "scored" ? sum + slotPoints(word.slot) : sum),
    0
  );

  const { error: endErr } = await admin
    .from("talk_track_turns")
    .update({
      ended_at: new Date().toISOString(),
      end_reason: reason,
    })
    .eq("id", turn.id)
    .is("ended_at", null);
  if (endErr) return fail(500, endErr.message);

  if (isDemoTurn(turn.card_id, turn.guesser_id)) {
    await patchSession(admin, sessionId, {
      phase: "team_reveal",
      current_turn_id: null,
      next_team_index: 0,
      hold_started_at: new Date().toISOString(),
      last_turn_points: 0,
      last_turn_end_reason: "skipped",
      paused: false,
    });
    await poke(admin, sessionId, "team_reveal");
    return { ok: true };
  }

  await patchSession(admin, sessionId, {
    phase: "hold",
    next_team_index: tt.next_team_index + 1,
    hold_started_at: new Date().toISOString(),
    last_turn_points: turnPoints,
    last_turn_end_reason: reason,
    paused: false,
  });
  void team;
  await poke(admin, sessionId, "hold");
  return { ok: true };
}

async function afterHold(
  admin: SupabaseClient,
  sessionId: string,
  tt: TalkTrackSessionRow,
  teams: TalkTrackTeamRow[]
): Promise<TalkTrackActionResult> {
  if (tt.next_team_index < tt.team_order.length) {
    return beginTurn(admin, sessionId, tt, teams);
  }

  if (tt.cycle_index < TALK_TRACK_MANDATORY_CYCLES) {
    const next: TalkTrackSessionRow = {
      ...tt,
      cycle_index: tt.cycle_index + 1,
      next_team_index: 0,
    };
    await patchSession(admin, sessionId, {
      cycle_index: next.cycle_index,
      next_team_index: 0,
    });
    return beginTurn(admin, sessionId, next, teams);
  }

  await patchSession(admin, sessionId, {
    phase: "another_round",
    hold_started_at: null,
    paused: false,
  });
  await poke(admin, sessionId, "another_round");
  return { ok: true };
}

export async function expireTurnIfNeeded(
  admin: SupabaseClient,
  sessionId: string
): Promise<void> {
  const tt = await loadTalkTrackSession(admin, sessionId);
  if (!tt || tt.phase !== "turn" || !tt.current_turn_id) return;
  const turn = await loadTurn(admin, tt.current_turn_id);
  if (!turn || turn.ended_at || !turn.started_at) return;
  if (!timerHasExpired(turn.started_at, Date.now())) return;
  const teams = await loadTeams(admin, sessionId);
  const team = teams.find((t) => t.id === turn.team_id);
  if (!team) return;
  await finishTurn(admin, sessionId, tt, turn, "timer", team);
}

export async function abandonIfGuesserGone(
  admin: SupabaseClient,
  sessionId: string
): Promise<void> {
  const tt = await loadTalkTrackSession(admin, sessionId);
  if (!tt || tt.phase !== "turn" || !tt.current_turn_id) return;
  const turn = await loadTurn(admin, tt.current_turn_id);
  if (!turn || turn.ended_at || !turn.guesser_id) return;
  const roster = await loadRoster(admin, sessionId);
  const live = liveMemberIds(
    roster.map((r) => r.participantId),
    connectedMap(roster)
  );
  const anyoneLive = live.length < roster.length;
  if (!anyoneLive) return;
  if (live.includes(turn.guesser_id)) return;
  const teams = await loadTeams(admin, sessionId);
  const team = teams.find((t) => t.id === turn.team_id);
  if (!team) return;
  await finishTurn(admin, sessionId, tt, turn, "abandoned", team);
}


/** Drop disconnected Talk Track members from the remaining train. Do not promote a clue-giver. */
export async function pruneDisconnectedTrain(
  admin: SupabaseClient,
  sessionId: string
): Promise<void> {
  const tt = await loadTalkTrackSession(admin, sessionId);
  if (!tt || tt.phase !== "turn" || !tt.current_turn_id) return;
  const turn = await loadTurn(admin, tt.current_turn_id);
  if (!turn || turn.ended_at) return;
  const roster = await loadRoster(admin, sessionId);
  const connected = connectedMap(roster);
  const anyoneLive = Object.values(connected).some(Boolean);
  if (!anyoneLive) return;
  const pruned = liveMemberIds(turn.train_ids, connected);
  if (
    pruned.length === turn.train_ids.length &&
    pruned.every((id, i) => id === turn.train_ids[i])
  ) {
    return;
  }
  const { error } = await admin
    .from("talk_track_turns")
    .update({ train_ids: pruned })
    .eq("id", turn.id);
  if (error) throw new Error(error.message);
  await poke(admin, sessionId, "turn");
}

export async function dispatchTalkTrackAction(input: {
  admin: SupabaseClient;
  sessionId: string;
  participantId: string;
  isLead: boolean;
  action: TalkTrackAction;
}): Promise<TalkTrackActionResult> {
  const { admin, sessionId, participantId, isLead, action } = input;

  await expireTurnIfNeeded(admin, sessionId);
  await abandonIfGuesserGone(admin, sessionId);
  await pruneDisconnectedTrain(admin, sessionId);

  const tt = await loadTalkTrackSession(admin, sessionId);
  if (!tt) return fail(404, "Talk Track has not started.");
  const teams = await loadTeams(admin, sessionId);
  const turn = tt.current_turn_id ? await loadTurn(admin, tt.current_turn_id) : null;

  switch (action.type) {
    case "pauseHold": {
      if (!isLead) return fail(403, "Only the facilitator can pause.");
      if (tt.phase !== "hold" && tt.phase !== "team_reveal") {
        return fail(409, "Nothing to pause.");
      }
      await patchSession(admin, sessionId, { paused: true });
      await poke(admin, sessionId, tt.phase);
      return { ok: true };
    }
    case "resumeHold": {
      if (!isLead) return fail(403, "Only the facilitator can resume.");
      await patchSession(admin, sessionId, {
        paused: false,
        hold_started_at: new Date().toISOString(),
      });
      await poke(admin, sessionId, tt.phase);
      return { ok: true };
    }
    case "advanceHold": {
      if (tt.phase !== "hold" && tt.phase !== "team_reveal") {
        return fail(409, "Not on a hold.");
      }
      if (tt.paused) return fail(409, "The facilitator paused the room.");
      if (!tt.hold_started_at) {
        if (!isLead) return { ok: true };
      } else if (!holdIsReady(tt.hold_started_at, Date.now()) && !isLead) {
        return fail(409, "Hold is still running.");
      }
      const claimed = await claimHoldAdvance(
        admin,
        sessionId,
        tt.phase,
        tt.hold_started_at
      );
      if (!claimed) return { ok: true };
      if (tt.phase === "team_reveal") {
        return beginTurn(admin, sessionId, tt, teams);
      }
      return afterHold(admin, sessionId, tt, teams);
    }
    case "stop": {
      if (!turn || tt.phase !== "turn" || turn.ended_at) {
        return fail(409, "No live sentence to stop.");
      }
      if (turn.subphase !== "cluing") return fail(409, "Already stopped.");
      if (!turn.train_ids.includes(participantId)) {
        return fail(403, "Only the Clue Train can stop.");
      }
      const { error } = await admin
        .from("talk_track_turns")
        .update({ subphase: "guessing" })
        .eq("id", turn.id)
        .eq("subphase", "cluing");
      if (error) return fail(500, error.message);
      await poke(admin, sessionId, "turn");
      return { ok: true };
    }
    case "resolve": {
      if (!turn || tt.phase !== "turn" || turn.ended_at) {
        return fail(409, "No live guess to mark.");
      }
      if (turn.subphase !== "guessing") {
        return fail(409, "Stop first.");
      }
      if (!turn.train_ids.includes(participantId)) {
        return fail(403, "Only the Clue Train can mark Got it or Pass.");
      }
      const outcome = action.outcome === "got_it" ? "scored" : "passed";
      const { data: updated, error } = await admin
        .from("talk_track_word_results")
        .update({
          outcome,
          decided_by: participantId,
          decided_at: new Date().toISOString(),
        })
        .eq("turn_id", turn.id)
        .eq("slot", turn.current_slot)
        .eq("outcome", "unset")
        .select("id, slot")
        .maybeSingle();
      if (error) return fail(500, error.message);
      if (!updated) return fail(409, "That word is already marked.");

      const demo = isDemoTurn(turn.card_id, turn.guesser_id);
      if (outcome === "scored" && !demo) {
        const team = teams.find((t) => t.id === turn.team_id);
        if (team) {
          await admin
            .from("talk_track_teams")
            .update({ score: team.score + slotPoints(turn.current_slot) })
            .eq("id", team.id);
        }
      }

      if (demo || turn.current_slot >= 5) {
        const team = teams.find((t) => t.id === turn.team_id);
        if (!team) return fail(500, "Team is missing.");
        return finishTurn(admin, sessionId, tt, turn, demo ? "skipped" : "all_five", team);
      }

      const { error: slotErr } = await admin
        .from("talk_track_turns")
        .update({
          current_slot: turn.current_slot + 1,
          subphase: "cluing",
        })
        .eq("id", turn.id);
      if (slotErr) return fail(500, slotErr.message);
      await poke(admin, sessionId, "turn");
      return { ok: true };
    }
    case "timerExpired": {
      if (!turn || !turn.started_at) return fail(409, "No live turn.");
      if (!timerHasExpired(turn.started_at, Date.now())) {
        return fail(409, "Time is still running.");
      }
      const team = teams.find((t) => t.id === turn.team_id);
      if (!team) return fail(500, "Team is missing.");
      return finishTurn(admin, sessionId, tt, turn, "timer", team);
    }
    case "nudge": {
      if (!isLead) return fail(403, "Only the facilitator can change the score.");
      if (tt.phase !== "hold" && tt.phase !== "final_scores") {
        return fail(409, "Scores are locked during the minute.");
      }
      const team = teams.find((t) => t.id === action.teamId);
      if (!team) return fail(404, "Team not found.");
      const { error: nudgeErr } = await admin.from("talk_track_score_nudges").insert({
        session_id: sessionId,
        team_id: team.id,
        delta: action.delta,
        created_by: participantId,
      });
      if (nudgeErr) return fail(500, nudgeErr.message);
      const { error: scoreErr } = await admin
        .from("talk_track_teams")
        .update({ score: team.score + action.delta })
        .eq("id", team.id);
      if (scoreErr) return fail(500, scoreErr.message);
      await poke(admin, sessionId, tt.phase);
      return { ok: true };
    }
    case "anotherRound": {
      if (!isLead) return fail(403, "Only the facilitator can start another round.");
      if (tt.phase !== "another_round") return fail(409, "Not time for another round.");
      if (!action.yes) {
        await patchSession(admin, sessionId, { phase: "final_scores" });
        await poke(admin, sessionId, "final_scores");
        return { ok: true };
      }
      const packId = await resolvePackId(admin, sessionId);
      const left = await remainingPlayableCards(admin, sessionId, packId);
      if (left < 1) {
        await patchSession(admin, sessionId, { phase: "final_scores" });
        await poke(admin, sessionId, "final_scores");
        return { ok: true };
      }
      const next: TalkTrackSessionRow = {
        ...tt,
        cycle_index: tt.cycle_index + 1,
        next_team_index: 0,
      };
      await patchSession(admin, sessionId, {
        cycle_index: next.cycle_index,
        next_team_index: 0,
      });
      return beginTurn(admin, sessionId, next, teams);
    }
    case "complete": {
      if (!isLead) return fail(403, "Only the facilitator can end the session.");
      if (tt.phase !== "final_scores") return fail(409, "Finish scoring first.");
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

export function starterIdForTurn(turn: TalkTrackTurnRow): string | null {
  if (turn.train_ids.length === 0) return null;
  const index = starterIndex(turn.current_slot, turn.train_ids.length);
  return turn.train_ids[index] ?? null;
}

export { TALK_TRACK_HOLD_SECONDS };
