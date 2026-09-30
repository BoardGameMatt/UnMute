import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSharedScreenName } from "@/lib/protocols/rank-and-file/engine";
import {
  expireState,
  initializeGame,
  applySubmissionTimeout,
  onDiscussionTimerExpired,
  leaderFewMore,
  oneMoreRound,
  processReveal,
  reduceTruthIsState,
  submitEntry,
  wrapUp,
} from "./engine";
import {
  loadRoster,
  loadTruthIsState,
  markSessionCompleted,
  saveTruthIsState,
  syncPublicPulse,
} from "./store";
import type { TruthIsClientAction, TruthIsState } from "./types";

type ActionOk = { ok: true };
type ActionErr = { ok: false; status: number; error: string };
export type TruthIsActionResult = ActionOk | ActionErr;

function fail(status: number, error: string): ActionErr {
  return { ok: false, status, error };
}

async function persist(
  admin: SupabaseClient,
  sessionId: string,
  before: TruthIsState,
  after: TruthIsState
): Promise<void> {
  if (after === before) return;
  await saveTruthIsState(admin, sessionId, after);
}

export async function expireIfNeeded(admin: SupabaseClient, sessionId: string): Promise<void> {
  const state = await loadTruthIsState(admin, sessionId);
  if (!state) return;
  const next = expireState(state, Date.now());
  await persist(admin, sessionId, state, next);
}

export async function resetTruthIsToLobby(admin: SupabaseClient, sessionId: string): Promise<void> {
  const { error: entriesErr } = await admin.from("truth_is_entries").delete().eq("session_id", sessionId);
  if (entriesErr) throw new Error(entriesErr.message);
  const { error } = await admin.from("truth_is_sessions").delete().eq("session_id", sessionId);
  if (error) throw new Error(error.message);
}

export async function startTruthIs(
  admin: SupabaseClient,
  sessionId: string
): Promise<ActionOk | ActionErr> {
  const roster = (await loadRoster(admin, sessionId)).filter(
    (member) => !isSharedScreenName(member.displayName)
  );
  if (roster.length < 3) return fail(400, "Need 3 to start.");
  if (roster.length > 20) return fail(400, "The Truth Is holds 20 people.");

  let state: TruthIsState;
  try {
    state = initializeGame(
      roster.map((member) => ({
        id: member.participantId,
        display_name: member.displayName,
      }))
    );
  } catch (err) {
    return fail(400, err instanceof Error ? err.message : "Could not start The Truth Is.");
  }

  await saveTruthIsState(admin, sessionId, state);
  return { ok: true };
}

export async function dispatchTruthIsAction(input: {
  admin: SupabaseClient;
  sessionId: string;
  participantId: string;
  isLead: boolean;
  action: TruthIsClientAction;
}): Promise<TruthIsActionResult> {
  const { admin, sessionId, participantId, isLead, action } = input;

  if (action.type === "advanceRecap") {
    if (!isLead) return fail(403, "Only the facilitator can continue.");
    const state = await loadTruthIsState(admin, sessionId);
    if (!state || state.phase !== "RESULTS") return fail(400, "Results are not open.");
    await markSessionCompleted(admin, sessionId);
    await syncPublicPulse(admin, sessionId, state);
    return { ok: true };
  }

  const recordsText = action.type === "submitEntry" || action.type === "submitOnTimeout";
  if (!recordsText) {
    await expireIfNeeded(admin, sessionId);
  }

  if (action.type === "timerExpired") {
    return { ok: true };
  }

  const state = await loadTruthIsState(admin, sessionId);
  if (!state) return fail(400, "The Truth Is has not started.");

  if (action.type === "submitEntry" || action.type === "submitOnTimeout") {
    const round = action.round;
    const phaseOk =
      (round === 1 && state.phase === "SUBMISSION_1") ||
      (round === 2 && state.phase === "SUBMISSION_2");
    if (!phaseOk) return { ok: true };
    if (!state.participants.some((person) => person.id === participantId)) {
      return fail(403, "The shared screen does not write a truth.");
    }

    if (action.type === "submitOnTimeout") {
      const next = applySubmissionTimeout(
        state,
        participantId,
        action.text,
        round,
        Date.now()
      );
      await persist(admin, sessionId, state, next);
      return { ok: true };
    }

    const already = state.entries.some(
      (entry) => entry.author_id === participantId && entry.round_submitted === round
    );
    let next = state;
    if (!(already && action.text.trim().length === 0)) {
      next = submitEntry(state, participantId, action.text, round);
    }
    await persist(admin, sessionId, state, next);
    return { ok: true };
  }

  if (action.type === "readyToVote") {
    if (state.phase !== "DISCUSSION") return { ok: true };
    if (state.current_reader_id !== participantId) {
      return fail(403, "Only the reader can open voting.");
    }
    const next = onDiscussionTimerExpired(state);
    await persist(admin, sessionId, state, next);
    return { ok: true };
  }

  if (action.type === "submitVote") {
    if (!state.participants.some((person) => person.id === participantId)) {
      return fail(403, "The shared screen does not guess.");
    }
    const known = state.participants.some((p) => p.id === action.guessedAuthorId);
    if (!known) return fail(400, "That person is not in this session.");
    const next = reduceTruthIsState(state, {
      type: "submitVote",
      voterId: participantId,
      guessedAuthorId: action.guessedAuthorId,
    });
    await persist(admin, sessionId, state, next);
    return { ok: true };
  }

  if (action.type === "processReveal") {
    const next = processReveal(state);
    await persist(admin, sessionId, state, next);
    return { ok: true };
  }

  if (action.type === "oneMoreRound") {
    if (!isLead) return fail(403, "Only the facilitator can do that.");
    if (state.phase !== "WRAP_UP") return fail(400, "That choice is not open.");
    const next = oneMoreRound(state);
    await persist(admin, sessionId, state, next);
    return { ok: true };
  }

  if (action.type === "dismissLeaderboard" || action.type === "leaderFewMore" || action.type === "wrapUp") {
    if (!isLead) return fail(403, "Only the facilitator can do that.");
    const next = reduceTruthIsState(state, { type: action.type });
    await persist(admin, sessionId, state, next);
    return { ok: true };
  }

  return fail(400, "Unknown action.");
}
