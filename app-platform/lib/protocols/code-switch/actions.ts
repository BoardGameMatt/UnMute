import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadLifecycle } from "@/lib/session/lifecycle";
import {
  GUESS_SECONDS,
  MIN_PLAYERS,
  WRITE_SECONDS,
  filterClues,
  guessMatches,
  pickGuesser,
  pickRoundType,
  pickWord,
  shuffleCopy,
  timerHasExpired,
  validateClue,
} from "./engine";
import {
  connectedIds,
  loadAllClues,
  loadClues,
  loadCodeSwitchSession,
  loadPackWords,
  loadRound,
  loadRounds,
  loadRoster,
  loadWord,
  resolvePackId,
  type CodeSwitchRoundRow,
  type CodeSwitchSessionRow,
  type RosterMember,
} from "./store";
import type { CodeSwitchAction, CodeSwitchEndReason } from "./types";

type ActionOk = { ok: true };
type ActionErr = { ok: false; status: number; error: string };
export type CodeSwitchActionResult = ActionOk | ActionErr;

function fail(status: number, error: string): ActionErr {
  return { ok: false, status, error };
}

export async function resetCodeSwitchToLobby(
  admin: SupabaseClient,
  sessionId: string
): Promise<void> {
  const lifecycle = await loadLifecycle(admin, sessionId);
  const { data, error } = await admin.rpc("reset_workshop_session", {
    p_session_id: sessionId, p_expected_version: lifecycle.lifecycle_version,
  });
  if (error || data !== true) throw new Error(error?.message ?? "The workshop changed. Refresh before resetting.");
}

export async function startCodeSwitch(
  admin: SupabaseClient, sessionId: string, expectedVersion?: number
): Promise<CodeSwitchActionResult> {
  const lifecycle = await loadLifecycle(admin, sessionId);
  if (lifecycle.status !== "lobby") return fail(409, "This workshop has already started or ended.");
  const roster = await loadRoster(admin, sessionId);
  if (roster.length < MIN_PLAYERS) return fail(400, "Need 4 to start.");
  const packId = await resolvePackId(admin, sessionId);
  const words = await loadPackWords(admin, packId);
  const word = pickWord(words, 1);
  const guesserId = pickGuesser(roster.map(row => row.participantId), [], connectedIds(roster));
  if (!word || !guesserId) return fail(400, "Could not prepare the first round.");
  const { data, error } = await admin.rpc("start_workshop_session", {
    p_session_id: sessionId, p_protocol: "code-switch",
    p_expected_version: expectedVersion ?? lifecycle.lifecycle_version,
    p_init: { wordId: word.id, guesserId, roundType: pickRoundType() },
  });
  if (error) return fail(500, error.message);
  return data === true ? { ok: true } : fail(409, "The workshop changed before Start. Refresh and try again.");
}

async function beginRound(
  admin: SupabaseClient,
  sessionId: string,
  cs: CodeSwitchSessionRow,
  roster: RosterMember[]
): Promise<CodeSwitchActionResult> {
  const packId = await resolvePackId(admin, sessionId);
  const words = await loadPackWords(admin, packId);
  const rounds = await loadRounds(admin, sessionId);
  const consumed = new Set(
    rounds
      .filter((row) => row.end_reason !== "abandoned")
      .map((row) => row.word_id)
  );
  const unused = words.filter((word) => !consumed.has(word.id));
  const nextIndex = rounds.length + 1;
  const word = pickWord(unused, nextIndex);
  if (!word) {
    return fail(400, "No unused words left. Wrap things up.");
  }

  const alreadyGuessed = rounds.map((row) => row.guesser_id);
  const guesserId = pickGuesser(
    roster.map((row) => row.participantId),
    alreadyGuessed,
    connectedIds(roster)
  );
  if (!guesserId) {
    return fail(500, "Could not pick a guesser.");
  }

  const { data, error } = await admin.rpc("start_code_switch_round", {
    p_session_id: sessionId, p_expected_round_id: cs.current_round_id,
    p_round: { index: nextIndex, guesserId, wordId: word.id, roundType: pickRoundType() },
  });
  if (error) return fail(500, error.message);
  return data === true ? { ok: true } : fail(409, "Another facilitator already moved this round.");
}

function clueGiverIds(roster: RosterMember[], guesserId: string): string[] {
  const present = connectedIds(roster);
  const pool = present.length > 0 ? present : roster.map((row) => row.participantId);
  return pool.filter((id) => id !== guesserId);
}

async function closeWrite(
  admin: SupabaseClient,
  sessionId: string,
  round: CodeSwitchRoundRow
): Promise<void> {
  for (let attempt = 0; attempt < 25; attempt++) {
    const clues = await loadClues(admin, round.id);
    const surviving = shuffleCopy(filterClues(clues.map((c) => c.normalized), round.round_type));
    const survivedSet = new Set(surviving);
    const { data, error } = await admin.rpc("commit_code_switch_transition", {
      p_session_id: sessionId, p_round_id: round.id,
      p_expected_phase: "write", p_next_phase: "guess",
      p_round_patch: { filtered_clues_json: surviving, guess_started_at: new Date().toISOString() },
      p_clues: clues.map((clue) => ({ id: clue.id, normalized: clue.normalized, survived: survivedSet.has(clue.normalized) })),
      p_score_delta: 0, p_extra: {},
    });
    if (error) throw new Error(error.message);
    if (data === true) return;
    const current = await loadCodeSwitchSession(admin, sessionId);
    if (current?.phase !== "write" || current.current_round_id !== round.id) return;
    // A clue arrived while we computed the filter. Retry the whole decision.
  }
  throw new Error("The room is updating. Please try again.");
}

async function resolveGuess(
  admin: SupabaseClient,
  sessionId: string,
  round: CodeSwitchRoundRow,
  guessText: string | null,
  reason: Extract<CodeSwitchEndReason, "guessed" | "timer">
): Promise<void> {
  const word = await loadWord(admin, round.word_id);
  const target = word?.word ?? "";
  const hit = guessText ? guessMatches(guessText, target) : false;
  const { error } = await admin.rpc("commit_code_switch_transition", {
    p_session_id: sessionId, p_round_id: round.id,
    p_expected_phase: "guess", p_next_phase: "reveal",
    p_round_patch: {
      guess_text: guessText,
      is_hit: hit,
      ended_at: new Date().toISOString(),
      end_reason: reason,
    },
    p_clues: null, p_score_delta: hit ? 1 : 0, p_extra: {},
  });
  if (error) throw new Error(error.message);
}

async function abandonRound(
  admin: SupabaseClient,
  sessionId: string,
  round: CodeSwitchRoundRow
): Promise<void> {
  const current = await loadCodeSwitchSession(admin, sessionId);
  if (!current || (current.phase !== "write" && current.phase !== "guess")) return;
  const { error } = await admin.rpc("commit_code_switch_transition", {
    p_session_id: sessionId, p_round_id: round.id,
    p_expected_phase: current.phase, p_next_phase: "reveal",
    p_round_patch: {
      ended_at: new Date().toISOString(),
      end_reason: "abandoned",
      filtered_clues_json: [],
    },
    p_clues: null, p_score_delta: 0, p_extra: { abandoned: true },
  });
  if (error) throw new Error(error.message);
}

export async function expireIfNeeded(
  admin: SupabaseClient,
  sessionId: string
): Promise<void> {
  await abandonIfGuesserGone(admin, sessionId);
  const cs = await loadCodeSwitchSession(admin, sessionId);
  if (!cs?.current_round_id) return;
  const round = await loadRound(admin, cs.current_round_id);
  if (!round) return;
  const now = Date.now();

  if (cs.phase === "write" && timerHasExpired(round.write_started_at, now, WRITE_SECONDS)) {
    await closeWrite(admin, sessionId, round);
    return;
  }
  if (cs.phase === "guess" && timerHasExpired(round.guess_started_at, now, GUESS_SECONDS)) {
    await resolveGuess(admin, sessionId, round, round.guess_text, "timer");
  }
}

export async function abandonIfGuesserGone(
  admin: SupabaseClient,
  sessionId: string
): Promise<void> {
  const cs = await loadCodeSwitchSession(admin, sessionId);
  if (!cs?.current_round_id) return;
  if (cs.phase !== "write" && cs.phase !== "guess") return;
  const round = await loadRound(admin, cs.current_round_id);
  if (!round || round.ended_at) return;
  const roster = await loadRoster(admin, sessionId);
  const present = connectedIds(roster);
  if (present.length === 0) return;
  if (present.includes(round.guesser_id)) return;
  await abandonRound(admin, sessionId, round);
}

async function maybeAdvanceWrite(
  admin: SupabaseClient,
  sessionId: string,
  round: CodeSwitchRoundRow,
  roster: RosterMember[]
): Promise<void> {
  const givers = clueGiverIds(roster, round.guesser_id);
  if (givers.length === 0) {
    await closeWrite(admin, sessionId, round);
    return;
  }
  const clues = await loadClues(admin, round.id);
  const locked = new Set(clues.map((c) => c.participant_id));
  if (givers.every((id) => locked.has(id))) {
    await closeWrite(admin, sessionId, round);
  }
}

export async function dispatchCodeSwitchAction(input: {
  admin: SupabaseClient;
  sessionId: string;
  participantId: string;
  isLead: boolean;
  action: CodeSwitchAction;
}): Promise<CodeSwitchActionResult> {
  const { admin, sessionId, participantId, isLead, action } = input;

  await abandonIfGuesserGone(admin, sessionId);
  await expireIfNeeded(admin, sessionId);

  const cs = await loadCodeSwitchSession(admin, sessionId);
  if (!cs) return fail(404, "SwitchCode has not started.");
  const round = cs.current_round_id ? await loadRound(admin, cs.current_round_id) : null;
  const roster = await loadRoster(admin, sessionId);

  if (action.roundId !== undefined &&
    (!round || action.roundId !== round.id)) return fail(409, "This input belongs to an earlier round and was not applied to this round.");

  if (action.type === "lockClue") {
    if (!round || typeof action.text !== "string") return fail(400, "Clues are not open.");
    if (participantId === round.guesser_id) {
      return fail(403, "The guesser cannot write a clue.");
    }
    const existing = (await loadClues(admin, round.id)).find((clue) => clue.participant_id === participantId);
    if (existing) {
      if (existing.raw_text !== action.text.trim()) return fail(409, "A different clue was already locked in.");
      if (cs.phase === "write") await maybeAdvanceWrite(admin, sessionId, round, roster);
      return { ok: true };
    }
    if (cs.phase !== "write") return fail(409, "Clues have closed. Your saved clue was not accepted.");
    const word = await loadWord(admin, round.word_id);
    if (!word) return fail(500, "The word is missing.");
    const valid = validateClue(action.text, word.word);
    if (!valid.ok) return fail(400, valid.error);
    const { data, error } = await admin.rpc("lock_code_switch_clue", {
      p_session_id: sessionId, p_round_id: round.id,
      p_participant_id: participantId, p_raw_text: action.text.trim(), p_normalized: valid.normalized,
    });
    if (error) {
      return fail(500, error.message);
    }
    if (data !== true) return fail(409, "Clues are no longer open.");
    await maybeAdvanceWrite(admin, sessionId, round, roster);
    return { ok: true };
  }

  if (action.type === "lockGuess") {
    if (!round || typeof action.text !== "string") return fail(400, "Guessing is not open.");
    if (participantId !== round.guesser_id) {
      return fail(403, "Only the guesser can lock a guess.");
    }
    if (round.end_reason === "guessed") return round.guess_text === action.text
      ? { ok: true } : fail(409, "A different guess was already locked in.");
    if (cs.phase !== "guess") return fail(409, "Guessing has closed. Your saved guess was not accepted.");
    await resolveGuess(admin, sessionId, round, action.text, "guessed");
    const saved = await loadRound(admin, round.id);
    if (saved?.guess_text !== action.text) return fail(409, "The round changed before your guess was accepted.");
    return { ok: true };
  }

  if (action.type === "timerExpired") {
    await expireIfNeeded(admin, sessionId);
    return { ok: true };
  }

  if (action.type === "anotherRound") {
    if (!isLead) return fail(403, "Only the facilitator can continue.");
    if (cs.phase !== "reveal") return fail(400, "Wait for the reveal.");
    const packId = await resolvePackId(admin, sessionId);
    const words = await loadPackWords(admin, packId);
    const rounds = await loadRounds(admin, sessionId);
    const consumed = rounds.filter((row) => row.end_reason !== "abandoned").length;
    if (consumed >= words.length) {
      return fail(400, "No unused words left. Wrap things up.");
    }
    return beginRound(admin, sessionId, cs, roster);
  }

  if (action.type === "wrap") {
    if (!isLead) return fail(403, "Only the facilitator can wrap.");
    if (cs.phase !== "reveal") return fail(400, "Wait for the reveal.");
    const { data, error } = await admin.rpc("finish_code_switch_phase", {
      p_session_id: sessionId, p_expected_round_id: round?.id ?? null, p_complete: false,
    });
    if (error) return fail(500, error.message);
    return data === true ? { ok: true } : fail(409, "The workshop changed before wrapping.");
  }

  if (action.type === "advanceRecap") {
    if (!isLead) return fail(403, "Only the facilitator can continue.");
    if (cs.phase !== "scoreboard") return fail(400, "Scores are not up yet.");
    const { data, error } = await admin.rpc("finish_code_switch_phase", {
      p_session_id: sessionId, p_expected_round_id: round?.id ?? null, p_complete: true,
    });
    if (error) return fail(500, error.message);
    return data === true ? { ok: true } : fail(409, "The workshop changed before completion.");
  }

  return fail(400, "Unknown action.");
}

export async function shownStatsForSession(
  admin: SupabaseClient,
  sessionId: string,
  roster: RosterMember[]
) {
  const rounds = await loadRounds(admin, sessionId);
  const finished = rounds.filter((row) => row.end_reason && row.end_reason !== "abandoned");
  const clues = await loadAllClues(
    admin,
    finished.map((row) => row.id)
  );
  const names = Object.fromEntries(roster.map((row) => [row.participantId, row.displayName]));
  return roster.map((row) => {
    const mine = clues.filter((clue) => clue.participant_id === row.participantId);
    const clueRounds = mine.length;
    const shownCount = mine.filter((clue) => clue.survived === true).length;
    return {
      participantId: row.participantId,
      displayName: names[row.participantId] ?? "Player",
      clueRounds,
      shownCount,
      shownRate: clueRounds === 0 ? 0 : shownCount / clueRounds,
    };
  });
}
