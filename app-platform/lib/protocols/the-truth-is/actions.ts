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
  loadTruthIsRecord,
  loadTruthIsState,
  markSessionCompleted,
  saveTruthIsState,
  syncPublicPulse,
  TruthIsWriteConflict,
} from "./store";
import type { TruthIsClientAction, TruthIsState } from "./types";

type ActionOk = { ok: true };
type ActionErr = { ok: false; status: number; error: string };
export type TruthIsActionResult = ActionOk | ActionErr;

function fail(status: number, error: string): ActionErr {
  return { ok: false, status, error };
}

const WRITE_ATTEMPTS = 5;

type Decision =
  | { kind: "result"; result: TruthIsActionResult }
  | { kind: "write"; next: TruthIsState };

async function commitAction(
  admin: SupabaseClient,
  sessionId: string,
  decide: (state: TruthIsState) => Decision
): Promise<TruthIsActionResult> {
  for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt++) {
    const loaded = await loadTruthIsRecord(admin, sessionId);
    if (!loaded) return fail(400, "The Truth Is has not started.");
    const decision = decide(loaded.state);
    if (decision.kind === "result") return decision.result;
    if (decision.next === loaded.state) return { ok: true };
    try {
      await saveTruthIsState(admin, sessionId, decision.next, loaded.writeVersion);
      return { ok: true };
    } catch (err) {
      if (err instanceof TruthIsWriteConflict) continue;
      throw err;
    }
  }
  return fail(409, "The room updated at the same time. Try again.");
}

async function persist(
  admin: SupabaseClient,
  sessionId: string,
  before: TruthIsState,
  after: TruthIsState,
  writeVersion: number
): Promise<void> {
  if (after === before) return;
  await saveTruthIsState(admin, sessionId, after, writeVersion);
}

export async function expireIfNeeded(admin: SupabaseClient, sessionId: string): Promise<void> {
  for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt++) {
    const loaded = await loadTruthIsRecord(admin, sessionId);
    if (!loaded) return;
    const next = expireState(loaded.state, Date.now());
    if (next === loaded.state) return;
    try {
      await persist(admin, sessionId, loaded.state, next, loaded.writeVersion);
      return;
    } catch (err) {
      if (err instanceof TruthIsWriteConflict) continue;
      throw err;
    }
  }
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

  try {
    await saveTruthIsState(admin, sessionId, state, 0);
  } catch (err) {
    if (err instanceof TruthIsWriteConflict) return { ok: true };
    throw err;
  }
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

  return commitAction(admin, sessionId, (state) => {
    if (action.type === "submitEntry" || action.type === "submitOnTimeout") {
      const round = action.round;
      const phaseOk =
        (round === 1 && state.phase === "SUBMISSION_1") ||
        (round === 2 && state.phase === "SUBMISSION_2");
      if (!phaseOk) return { kind: "result", result: { ok: true } };
      if (!state.participants.some((person) => person.id === participantId)) {
        return { kind: "result", result: fail(403, "The shared screen does not write a truth.") };
      }

      if (action.type === "submitOnTimeout") {
        return {
          kind: "write",
          next: applySubmissionTimeout(state, participantId, action.text, round, Date.now()),
        };
      }

      const already = state.entries.some(
        (entry) => entry.author_id === participantId && entry.round_submitted === round
      );
      let next = state;
      if (!(already && action.text.trim().length === 0)) {
        next = submitEntry(state, participantId, action.text, round);
      }
      return { kind: "write", next };
    }

    if (action.type === "readyToVote") {
      if (state.phase !== "DISCUSSION") return { kind: "result", result: { ok: true } };
      if (state.current_reader_id !== participantId) {
        return { kind: "result", result: fail(403, "Only the reader can open voting.") };
      }
      return { kind: "write", next: onDiscussionTimerExpired(state) };
    }

    if (action.type === "submitVote") {
      if (!state.participants.some((person) => person.id === participantId)) {
        return { kind: "result", result: fail(403, "The shared screen does not guess.") };
      }
      const known = state.participants.some((p) => p.id === action.guessedAuthorId);
      if (!known) return { kind: "result", result: fail(400, "That person is not in this session.") };
      return {
        kind: "write",
        next: reduceTruthIsState(state, {
          type: "submitVote",
          voterId: participantId,
          guessedAuthorId: action.guessedAuthorId,
        }),
      };
    }

    if (action.type === "processReveal") {
      return { kind: "write", next: processReveal(state) };
    }

    if (action.type === "oneMoreRound") {
      if (!isLead) return { kind: "result", result: fail(403, "Only the facilitator can do that.") };
      if (state.phase !== "WRAP_UP") return { kind: "result", result: fail(400, "That choice is not open.") };
      return { kind: "write", next: oneMoreRound(state) };
    }

    if (action.type === "dismissLeaderboard" || action.type === "leaderFewMore" || action.type === "wrapUp") {
      if (!isLead) return { kind: "result", result: fail(403, "Only the facilitator can do that.") };
      return { kind: "write", next: reduceTruthIsState(state, { type: action.type }) };
    }

    return { kind: "result", result: fail(400, "Unknown action.") };
  });
}
