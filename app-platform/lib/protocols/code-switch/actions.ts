import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/lib/types/database";
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
  syncPublicState,
  type CodeSwitchRoundRow,
  type CodeSwitchSessionRow,
  type RosterMember,
} from "./store";
import type { CodeSwitchAction, CodeSwitchEndReason, CodeSwitchPhase } from "./types";

type ActionOk = { ok: true };
type ActionErr = { ok: false; status: number; error: string };
export type CodeSwitchActionResult = ActionOk | ActionErr;

function fail(status: number, error: string): ActionErr {
  return { ok: false, status, error };
}

async function poke(
  admin: SupabaseClient,
  sessionId: string,
  phase: CodeSwitchPhase,
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
    .from("code_switch_sessions")
    .update(patch)
    .eq("session_id", sessionId);
  if (error) throw new Error(error.message);
}

async function patchSessionIfPhase(
  admin: SupabaseClient,
  sessionId: string,
  expected: CodeSwitchPhase,
  patch: Record<string, unknown>
): Promise<boolean> {
  const { data, error } = await admin
    .from("code_switch_sessions")
    .update(patch)
    .eq("session_id", sessionId)
    .eq("phase", expected)
    .select("session_id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function resetCodeSwitchToLobby(
  admin: SupabaseClient,
  sessionId: string
): Promise<void> {
  await admin
    .from("code_switch_sessions")
    .update({ current_round_id: null })
    .eq("session_id", sessionId);
  await admin.from("code_switch_rounds").delete().eq("session_id", sessionId);
  await admin.from("code_switch_sessions").delete().eq("session_id", sessionId);
}

export async function startCodeSwitch(
  admin: SupabaseClient,
  sessionId: string
): Promise<CodeSwitchActionResult> {
  const roster = await loadRoster(admin, sessionId);
  if (roster.length < MIN_PLAYERS) {
    return fail(400, "Need 4 to start.");
  }

  await resolvePackId(admin, sessionId);
  await resetCodeSwitchToLobby(admin, sessionId);

  const { error } = await admin.from("code_switch_sessions").insert({
    session_id: sessionId,
    phase: "write",
    team_score: 0,
    current_round_id: null,
  });
  if (error) return fail(500, error.message);

  const cs = await loadCodeSwitchSession(admin, sessionId);
  if (!cs) return fail(500, "SwitchCode session did not save.");
  return beginRound(admin, sessionId, cs, roster);
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

  const now = new Date().toISOString();
  const { data: inserted, error } = await admin
    .from("code_switch_rounds")
    .insert({
      session_id: sessionId,
      round_index: nextIndex,
      guesser_id: guesserId,
      word_id: word.id,
      round_type: pickRoundType(),
      write_started_at: now,
    })
    .select("id")
    .single();
  if (error || !inserted) return fail(500, error?.message ?? "Could not start the round.");

  await patchSession(admin, sessionId, {
    phase: "write",
    current_round_id: inserted.id,
  });
  await poke(admin, sessionId, "write");
  return { ok: true };
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
  const claimed = await patchSessionIfPhase(admin, sessionId, "write", { phase: "guess" });
  if (!claimed) return;

  const clues = await loadClues(admin, round.id);
  const surviving = shuffleCopy(filterClues(clues.map((c) => c.normalized), round.round_type));
  const survivedSet = new Set(surviving);

  for (const clue of clues) {
    const { error } = await admin
      .from("code_switch_clues")
      .update({ survived: survivedSet.has(clue.normalized) })
      .eq("id", clue.id);
    if (error) throw new Error(error.message);
  }

  const { error } = await admin
    .from("code_switch_rounds")
    .update({
      filtered_clues_json: surviving,
      guess_started_at: new Date().toISOString(),
    })
    .eq("id", round.id);
  if (error) throw new Error(error.message);

  await poke(admin, sessionId, "guess");
}

async function resolveGuess(
  admin: SupabaseClient,
  sessionId: string,
  cs: CodeSwitchSessionRow,
  round: CodeSwitchRoundRow,
  guessText: string | null,
  reason: Extract<CodeSwitchEndReason, "guessed" | "timer">
): Promise<void> {
  const claimed = await patchSessionIfPhase(admin, sessionId, "guess", { phase: "reveal" });
  if (!claimed) return;

  const word = await loadWord(admin, round.word_id);
  const target = word?.word ?? "";
  const hit = guessText ? guessMatches(guessText, target) : false;
  const { error } = await admin
    .from("code_switch_rounds")
    .update({
      guess_text: guessText,
      is_hit: hit,
      ended_at: new Date().toISOString(),
      end_reason: reason,
    })
    .eq("id", round.id);
  if (error) throw new Error(error.message);

  await patchSession(admin, sessionId, {
    phase: "reveal",
    team_score: hit ? cs.team_score + 1 : cs.team_score,
  });
  await poke(admin, sessionId, "reveal");
}

async function abandonRound(
  admin: SupabaseClient,
  sessionId: string,
  round: CodeSwitchRoundRow
): Promise<void> {
  const { error } = await admin
    .from("code_switch_rounds")
    .update({
      ended_at: new Date().toISOString(),
      end_reason: "abandoned",
      filtered_clues_json: [],
    })
    .eq("id", round.id)
    .is("ended_at", null);
  if (error) throw new Error(error.message);

  await patchSession(admin, sessionId, { phase: "reveal" });
  await poke(admin, sessionId, "reveal", { abandoned: true });
}

export async function expireIfNeeded(
  admin: SupabaseClient,
  sessionId: string
): Promise<void> {
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
    await resolveGuess(admin, sessionId, cs, round, round.guess_text, "timer");
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

  await expireIfNeeded(admin, sessionId);
  await abandonIfGuesserGone(admin, sessionId);

  const cs = await loadCodeSwitchSession(admin, sessionId);
  if (!cs) return fail(404, "SwitchCode has not started.");
  const round = cs.current_round_id ? await loadRound(admin, cs.current_round_id) : null;
  const roster = await loadRoster(admin, sessionId);

  if (action.type === "lockClue") {
    if (!round || cs.phase !== "write") return fail(400, "Clues are not open.");
    if (participantId === round.guesser_id) {
      return fail(403, "The guesser cannot write a clue.");
    }
    const word = await loadWord(admin, round.word_id);
    if (!word) return fail(500, "The word is missing.");
    const valid = validateClue(action.text, word.word);
    if (!valid.ok) return fail(400, valid.error);
    const { error } = await admin.from("code_switch_clues").insert({
      round_id: round.id,
      participant_id: participantId,
      raw_text: action.text.trim(),
      normalized: valid.normalized,
    });
    if (error) {
      if (error.code === "23505") return { ok: true };
      return fail(500, error.message);
    }
    await maybeAdvanceWrite(admin, sessionId, round, roster);
    const after = await loadCodeSwitchSession(admin, sessionId);
    await poke(admin, sessionId, after?.phase ?? "write");
    return { ok: true };
  }

  if (action.type === "lockGuess") {
    if (!round || cs.phase !== "guess") return fail(400, "Guessing is not open.");
    if (participantId !== round.guesser_id) {
      return fail(403, "Only the guesser can lock a guess.");
    }
    await resolveGuess(admin, sessionId, cs, round, action.text, "guessed");
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
    await patchSession(admin, sessionId, { phase: "scoreboard" });
    await poke(admin, sessionId, "scoreboard");
    return { ok: true };
  }

  if (action.type === "advanceRecap") {
    if (!isLead) return fail(403, "Only the facilitator can continue.");
    if (cs.phase !== "scoreboard") return fail(400, "Scores are not up yet.");
    await admin
      .from("sessions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", sessionId);
    await poke(admin, sessionId, "scoreboard", { recapAdvanced: true });
    return { ok: true };
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
