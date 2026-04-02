/**
 * Pure state transitions for "The Truth Is..." — no React; safe to run on the server.
 */

import type {
  TruthIsEntry,
  TruthIsParticipant,
  TruthIsState,
} from "./types";
import { TRUTH_IS_PROTOCOL_VERSION } from "./types";

const MAX_ENTRY_LENGTH = 300;

function nowIso(): string {
  return new Date().toISOString();
}

export function newEntryId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `entry_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickRandom<T>(items: T[]): T {
  if (items.length === 0) {
    throw new Error("pickRandom: empty array");
  }
  return items[Math.floor(Math.random() * items.length)] as T;
}

function emptyScores(participantIds: string[]): Record<string, number> {
  return Object.fromEntries(participantIds.map((id) => [id, 0]));
}

/** Build initial state and begin SUBMISSION_1. */
export function initializeGame(participants: TruthIsParticipant[]): TruthIsState {
  if (participants.length < 3 || participants.length > 20) {
    throw new Error("Player count must be between 3 and 20.");
  }
  const ids = participants.map((p) => p.id);
  const minimum = participants.length;

  return {
    version: TRUTH_IS_PROTOCOL_VERSION,
    phase: "SUBMISSION_1",
    participants,
    entries: [],
    scores: emptyScores(ids),
    play_order: [],
    play_order_index: 0,
    current_round: 0,
    total_rounds_played: 0,
    minimum_rounds: minimum,
    progress_total_rounds: minimum,
    current_entry_id: null,
    current_reader_id: null,
    current_author_id: null,
    next_reader_from_previous_author_id: null,
    timer_started_at: nowIso(),
    timer_duration_seconds: 42,
    votes_this_round: {},
    lead_chose_continue: false,
    few_more_extra_entries: 0,
    last_leaderboard_at_round: 0,
    most_surprising_entry_id: null,
    session_complete: false,
    skipped_rounds: {},
  };
}

/** Restart submission round 1 timer (e.g. after reconnect). */
export function startSubmission1(state: TruthIsState): TruthIsState {
  return {
    ...state,
    phase: "SUBMISSION_1",
    timer_started_at: nowIso(),
    timer_duration_seconds: 42,
  };
}

function trimText(text: string): string {
  const t = text.trim();
  if (t.length <= MAX_ENTRY_LENGTH) return t;
  return t.slice(0, MAX_ENTRY_LENGTH);
}

function hasFinishedRound(state: TruthIsState, participantId: string, round: 1 | 2): boolean {
  const hasEntry = state.entries.some(
    (e) => e.author_id === participantId && e.round_submitted === round
  );
  const skip = state.skipped_rounds[participantId];
  if (round === 1) {
    return hasEntry || skip?.r1 === true;
  }
  return hasEntry || skip?.r2 === true;
}

function allSubmittedForRound(state: TruthIsState, round: 1 | 2): boolean {
  return state.participants.every((p) => hasFinishedRound(state, p.id, round));
}

/** Player submits or updates their entry for the given submission round. */
export function submitEntry(
  state: TruthIsState,
  participantId: string,
  text: string,
  round: 1 | 2
): TruthIsState {
  if (state.phase !== "SUBMISSION_1" && state.phase !== "SUBMISSION_2") {
    return state;
  }
  if ((state.phase === "SUBMISSION_1" && round !== 1) || (state.phase === "SUBMISSION_2" && round !== 2)) {
    return state;
  }

  const trimmed = trimText(text);
  const existingIdx = state.entries.findIndex(
    (e) => e.author_id === participantId && e.round_submitted === round
  );

  let entries: TruthIsEntry[];
  let skipped_rounds = { ...state.skipped_rounds };

  if (trimmed.length === 0) {
    if (existingIdx >= 0) {
      entries = state.entries.filter((_, i) => i !== existingIdx);
    } else {
      entries = state.entries;
      const prev = skipped_rounds[participantId] ?? {};
      skipped_rounds = {
        ...skipped_rounds,
        [participantId]: {
          ...prev,
          ...(round === 1 ? { r1: true } : { r2: true }),
        },
      };
    }
  } else {
    const row: TruthIsEntry = {
      id: existingIdx >= 0 ? state.entries[existingIdx].id : newEntryId(),
      author_id: participantId,
      text: trimmed,
      round_submitted: round,
      used: false,
      guesses: existingIdx >= 0 ? state.entries[existingIdx].guesses : {},
      correct_count: existingIdx >= 0 ? state.entries[existingIdx].correct_count : 0,
    };
    if (existingIdx >= 0) {
      entries = state.entries.map((e, i) => (i === existingIdx ? row : e));
    } else {
      entries = [...state.entries, row];
    }
  }

  let next: TruthIsState = {
    ...state,
    entries,
    skipped_rounds,
  };

  if (round === 1 && allSubmittedForRound(next, 1)) {
    next = startSubmission2(next);
  } else if (round === 2 && allSubmittedForRound(next, 2)) {
    next = finalizeSubmission2AndBuildPlayOrder(next);
  }

  return next;
}

/** Timer fired: mark non-submitters as skipped and advance phase when everyone is accounted for. */
export function onSubmissionTimerExpired(state: TruthIsState, round: 1 | 2): TruthIsState {
  if ((round === 1 && state.phase !== "SUBMISSION_1") || (round === 2 && state.phase !== "SUBMISSION_2")) {
    return state;
  }

  let skipped_rounds = { ...state.skipped_rounds };
  for (const p of state.participants) {
    if (hasFinishedRound(state, p.id, round)) continue;
    const prev = skipped_rounds[p.id] ?? {};
    skipped_rounds = {
      ...skipped_rounds,
      [p.id]: {
        ...prev,
        ...(round === 1 ? { r1: true } : { r2: true }),
      },
    };
  }

  const next: TruthIsState = {
    ...state,
    skipped_rounds,
  };

  if (round === 1 && allSubmittedForRound(next, 1)) {
    return startSubmission2(next);
  }
  if (round === 2 && allSubmittedForRound(next, 2)) {
    return finalizeSubmission2AndBuildPlayOrder(next);
  }
  return next;
}

export function startSubmission2(state: TruthIsState): TruthIsState {
  if (state.phase !== "SUBMISSION_1") {
    return state;
  }
  return {
    ...state,
    phase: "SUBMISSION_2",
    timer_started_at: nowIso(),
    timer_duration_seconds: 42,
  };
}

/** Pool entries, shuffle play order, assign first reading. */
export function finalizeSubmission2AndBuildPlayOrder(state: TruthIsState): TruthIsState {
  if (state.entries.length === 0) {
    return {
      ...state,
      phase: "WRAP_UP",
      timer_started_at: null,
      timer_duration_seconds: 0,
      current_entry_id: null,
      current_reader_id: null,
      current_author_id: null,
    };
  }

  const play_order = shuffle(state.entries.map((e) => e.id));
  let next: TruthIsState = {
    ...state,
    phase: "READING_ASSIGNMENT",
    play_order,
    play_order_index: 0,
    timer_started_at: null,
    timer_duration_seconds: 0,
  };
  next = assignReader(next);
  return next;
}

/**
 * Select reader + entry for the current cycle.
 * Round 1: random reader. Later: previous entry's author reads next (spec).
 */
export function assignReader(state: TruthIsState): TruthIsState {
  if (state.phase !== "READING_ASSIGNMENT") {
    return state;
  }

  const unused = state.entries.filter((e) => !e.used);
  if (unused.length === 0) {
    return transitionWhenNoEntries(state);
  }

  let readerId: string;
  if (state.total_rounds_played === 0) {
    readerId = pickRandom(state.participants.map((p) => p.id));
  } else if (state.next_reader_from_previous_author_id) {
    readerId = state.next_reader_from_previous_author_id;
  } else {
    readerId = pickRandom(state.participants.map((p) => p.id));
  }

  const orderedIds = state.play_order.filter((id) => unused.some((u) => u.id === id));

  const tryReader = (r: string): TruthIsEntry | undefined => {
    for (const entryId of orderedIds) {
      const e = state.entries.find((x) => x.id === entryId);
      if (!e || e.used) continue;
      if (e.author_id !== r) return e;
    }
    return undefined;
  };

  let entry = tryReader(readerId);
  let chosenReader = readerId;

  if (!entry) {
    const readers = shuffle(state.participants.map((p) => p.id));
    for (const r of readers) {
      const e = tryReader(r);
      if (e) {
        entry = e;
        chosenReader = r;
        break;
      }
    }
  }

  if (!entry) {
    return transitionWhenNoEntries(state);
  }

  return {
    ...state,
    phase: "DISCUSSION",
    current_round: state.current_round + 1,
    current_entry_id: entry.id,
    current_reader_id: chosenReader,
    current_author_id: entry.author_id,
    votes_this_round: {},
    timer_started_at: nowIso(),
    timer_duration_seconds: 30,
  };
}

function transitionWhenNoEntries(state: TruthIsState): TruthIsState {
  if (state.total_rounds_played >= state.minimum_rounds) {
    return {
      ...state,
      phase: "WRAP_UP",
      current_entry_id: null,
      current_reader_id: null,
      current_author_id: null,
      timer_started_at: null,
      timer_duration_seconds: 0,
    };
  }
  return getResults({
    ...state,
    phase: "RESULTS",
    current_entry_id: null,
    current_reader_id: null,
    current_author_id: null,
    timer_started_at: null,
    timer_duration_seconds: 0,
  });
}

/** Legacy: READING_ASSIGNMENT → DISCUSSION (new rounds start in DISCUSSION with timer). */
export function startDiscussion(state: TruthIsState): TruthIsState {
  if (state.phase !== "READING_ASSIGNMENT") {
    return state;
  }
  return {
    ...state,
    phase: "DISCUSSION",
    timer_started_at: nowIso(),
    timer_duration_seconds: 30,
  };
}

/** Discussion segment elapsed — move to voting (15s). */
export function onDiscussionTimerExpired(state: TruthIsState): TruthIsState {
  if (state.phase !== "DISCUSSION") {
    return state;
  }
  return {
    ...state,
    phase: "VOTING",
    timer_started_at: nowIso(),
    timer_duration_seconds: 15,
  };
}

/** Voting time ended — freeze votes and enter reveal. */
export function onVotingTimerExpired(state: TruthIsState): TruthIsState {
  if (state.phase !== "VOTING") {
    return state;
  }
  return {
    ...state,
    phase: "REVEAL",
    timer_started_at: null,
    timer_duration_seconds: 0,
  };
}

/** Record a guess; author cannot vote on their own entry. */
export function submitVote(
  state: TruthIsState,
  voterId: string,
  guessedAuthorId: string
): TruthIsState {
  if (state.phase !== "VOTING") {
    return state;
  }
  if (state.current_author_id && voterId === state.current_author_id) {
    return state;
  }
  return {
    ...state,
    votes_this_round: {
      ...state.votes_this_round,
      [voterId]: guessedAuthorId,
    },
  };
}

/** After all non-authors have voted, advance early to reveal. */
export function tryCompleteVotingEarly(state: TruthIsState): TruthIsState {
  if (state.phase !== "VOTING" || !state.current_author_id) {
    return state;
  }
  const voters = state.participants.filter((p) => p.id !== state.current_author_id);
  const allIn = voters.every((p) => state.votes_this_round[p.id] !== undefined);
  if (!allIn) {
    return state;
  }
  return onVotingTimerExpired(state);
}

/**
 * Awards points, marks entry used, rotates reader, decides leaderboard vs next round.
 * Call when REVEAL animations finish on the client.
 */
export function processReveal(state: TruthIsState): TruthIsState {
  if (state.phase !== "REVEAL" || !state.current_entry_id || !state.current_author_id) {
    return state;
  }

  const entryId = state.current_entry_id;
  const authorId = state.current_author_id;

  const entries = state.entries.map((e) => {
    if (e.id !== entryId) return e;
    const guesses = { ...e.guesses, ...state.votes_this_round };
    let correct = 0;
    for (const [, guessed] of Object.entries(state.votes_this_round)) {
      if (guessed === authorId) correct += 1;
    }
    return {
      ...e,
      used: true,
      guesses,
      correct_count: e.correct_count + correct,
    };
  });

  const scores = { ...state.scores };
  for (const [voterId, guessed] of Object.entries(state.votes_this_round)) {
    if (guessed === authorId) {
      scores[voterId] = (scores[voterId] ?? 0) + 1;
    }
  }

  const total_rounds_played = state.total_rounds_played + 1;
  const next_reader_from_previous_author_id = authorId;

  const base: TruthIsState = {
    ...state,
    entries,
    scores,
    total_rounds_played,
    next_reader_from_previous_author_id,
    votes_this_round: {},
    current_entry_id: null,
    current_reader_id: null,
    current_author_id: null,
  };

  if (
    checkLeaderboard(total_rounds_played) &&
    total_rounds_played !== state.last_leaderboard_at_round
  ) {
    return {
      ...base,
      phase: "LEADERBOARD",
      last_leaderboard_at_round: total_rounds_played,
      timer_started_at: nowIso(),
      timer_duration_seconds: 5,
    };
  }

  return advanceToNextRound({
    ...base,
    phase: "READING_ASSIGNMENT",
  });
}

/** After leaderboard auto-dismiss or lead skip. */
export function dismissLeaderboard(state: TruthIsState): TruthIsState {
  if (state.phase !== "LEADERBOARD") {
    return state;
  }
  let next: TruthIsState = {
    ...state,
    phase: "READING_ASSIGNMENT",
    timer_started_at: null,
    timer_duration_seconds: 0,
  };
  return advanceToNextRound(next);
}

/** Show leaderboard after round 2, then every 3 rounds (2, 5, 8, …). */
export function checkLeaderboard(roundNumber: number): boolean {
  if (roundNumber < 2) return false;
  if (roundNumber === 2) return true;
  return (roundNumber - 2) % 3 === 0;
}

/** Continue after a reveal or leaderboard: assign next reader or wrap up. */
export function advanceToNextRound(state: TruthIsState): TruthIsState {
  if (state.phase !== "READING_ASSIGNMENT") {
    return state;
  }
  return assignReader(state);
}

export function onLeaderboardTimerExpired(state: TruthIsState): TruthIsState {
  if (state.phase !== "LEADERBOARD") {
    return state;
  }
  return dismissLeaderboard(state);
}

/** Lead ends the session from WRAP_UP. */
export function wrapUp(state: TruthIsState): TruthIsState {
  if (state.phase !== "WRAP_UP") {
    return state;
  }
  return getResults(state);
}

/** Lead chooses to add a few more rounds from remaining entries. */
export function leaderFewMore(state: TruthIsState): TruthIsState {
  if (state.phase !== "WRAP_UP") {
    return state;
  }
  const remaining = state.entries.filter((e) => !e.used).map((e) => e.id);
  if (remaining.length === 0) {
    return getResults({ ...state, phase: "WRAP_UP" });
  }
  const extra = Math.min(4, Math.max(3, remaining.length));
  const play_order = shuffle(remaining);
  const patched: TruthIsState = {
    ...state,
    phase: "READING_ASSIGNMENT",
    play_order,
    play_order_index: 0,
    progress_total_rounds: state.progress_total_rounds + extra,
    few_more_extra_entries: state.few_more_extra_entries + extra,
    lead_chose_continue: true,
    timer_started_at: null,
    timer_duration_seconds: 0,
  };
  return assignReader(patched);
}

/** Finalize stats and RESULTS phase. */
export function getResults(state: TruthIsState): TruthIsState {
  let mostSurprising: string | null = null;
  let worst = -1;
  for (const e of state.entries) {
    const wrong = Object.values(e.guesses).filter((g) => g !== e.author_id).length;
    if (wrong > worst) {
      worst = wrong;
      mostSurprising = e.id;
    }
  }

  return {
    ...state,
    phase: "RESULTS",
    most_surprising_entry_id: worst > 0 ? mostSurprising : null,
    session_complete: true,
    timer_started_at: null,
    timer_duration_seconds: 0,
  };
}

export type TruthIsEngineAction =
  | { type: "initializeGame"; participants: TruthIsParticipant[] }
  | { type: "startSubmission1" }
  | { type: "submitEntry"; participantId: string; text: string; round: 1 | 2 }
  | { type: "submissionTimerExpired"; round: 1 | 2 }
  | { type: "startSubmission2" }
  | { type: "finalizeSubmission2" }
  | { type: "assignReader" }
  | { type: "startDiscussion" }
  | { type: "discussionTimerExpired" }
  | { type: "votingTimerExpired" }
  | { type: "submitVote"; voterId: string; guessedAuthorId: string }
  | { type: "tryCompleteVotingEarly" }
  | { type: "processReveal" }
  | { type: "advanceToNextRound" }
  | { type: "dismissLeaderboard" }
  | { type: "leaderboardTimerExpired" }
  | { type: "leaderFewMore" }
  | { type: "wrapUp" }
  | { type: "getResults" }
  | { type: "endSession" };

export function reduceTruthIsState(
  state: TruthIsState | null,
  action: TruthIsEngineAction
): TruthIsState {
  switch (action.type) {
    case "initializeGame":
      return initializeGame(action.participants);
    case "startSubmission1":
      if (!state) throw new Error("Truth Is state not initialized");
      return startSubmission1(state);
    case "submitEntry":
      if (!state) throw new Error("Truth Is state not initialized");
      return submitEntry(state, action.participantId, action.text, action.round);
    case "submissionTimerExpired":
      if (!state) throw new Error("Truth Is state not initialized");
      return onSubmissionTimerExpired(state, action.round);
    case "startSubmission2":
      if (!state) throw new Error("Truth Is state not initialized");
      return startSubmission2(state);
    case "finalizeSubmission2":
      if (!state) throw new Error("Truth Is state not initialized");
      return finalizeSubmission2AndBuildPlayOrder(state);
    case "assignReader":
      if (!state) throw new Error("Truth Is state not initialized");
      return assignReader(state);
    case "startDiscussion":
      if (!state) throw new Error("Truth Is state not initialized");
      return startDiscussion(state);
    case "discussionTimerExpired":
      if (!state) throw new Error("Truth Is state not initialized");
      return onDiscussionTimerExpired(state);
    case "votingTimerExpired":
      if (!state) throw new Error("Truth Is state not initialized");
      return onVotingTimerExpired(state);
    case "submitVote":
      if (!state) throw new Error("Truth Is state not initialized");
      return tryCompleteVotingEarly(
        submitVote(state, action.voterId, action.guessedAuthorId)
      );
    case "tryCompleteVotingEarly":
      if (!state) throw new Error("Truth Is state not initialized");
      return tryCompleteVotingEarly(state);
    case "processReveal":
      if (!state) throw new Error("Truth Is state not initialized");
      return processReveal(state);
    case "advanceToNextRound":
      if (!state) throw new Error("Truth Is state not initialized");
      return advanceToNextRound(state);
    case "dismissLeaderboard":
      if (!state) throw new Error("Truth Is state not initialized");
      return dismissLeaderboard(state);
    case "leaderboardTimerExpired":
      if (!state) throw new Error("Truth Is state not initialized");
      return onLeaderboardTimerExpired(state);
    case "leaderFewMore":
      if (!state) throw new Error("Truth Is state not initialized");
      return leaderFewMore(state);
    case "wrapUp":
      if (!state) throw new Error("Truth Is state not initialized");
      return wrapUp(state);
    case "getResults":
      if (!state) throw new Error("Truth Is state not initialized");
      return getResults(state);
    case "endSession":
      if (!state) throw new Error("Truth Is state not initialized");
      return { ...getResults(state), session_complete: true };
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

/** Maps client actionType + JSON payload to engine actions (API route). */
export function clientPayloadToEngineAction(
  actionType: string,
  payload: Record<string, unknown>
): TruthIsEngineAction {
  switch (actionType) {
    case "initializeGame": {
      const participants = payload.participants;
      if (!Array.isArray(participants)) {
        throw new Error("initializeGame requires participants: array");
      }
      return {
        type: "initializeGame",
        participants: participants as TruthIsParticipant[],
      };
    }
    case "startSubmission1":
      return { type: "startSubmission1" };
    case "submitEntry": {
      const participantId = payload.participantId;
      const text = payload.text;
      const round = payload.round;
      if (typeof participantId !== "string" || typeof text !== "string") {
        throw new Error("submitEntry requires participantId and text");
      }
      if (round !== 1 && round !== 2) {
        throw new Error("submitEntry requires round: 1 | 2");
      }
      return { type: "submitEntry", participantId, text, round };
    }
    case "submissionTimerExpired": {
      const round = payload.round;
      if (round !== 1 && round !== 2) {
        throw new Error("submissionTimerExpired requires round: 1 | 2");
      }
      return { type: "submissionTimerExpired", round };
    }
    case "startSubmission2":
      return { type: "startSubmission2" };
    case "finalizeSubmission2":
      return { type: "finalizeSubmission2" };
    case "assignReader":
      return { type: "assignReader" };
    case "startDiscussion":
      return { type: "startDiscussion" };
    case "discussionTimerExpired":
      return { type: "discussionTimerExpired" };
    case "votingTimerExpired":
      return { type: "votingTimerExpired" };
    case "submitVote": {
      const voterId = payload.voterId;
      const guessedAuthorId = payload.guessedAuthorId;
      if (typeof voterId !== "string" || typeof guessedAuthorId !== "string") {
        throw new Error("submitVote requires voterId and guessedAuthorId");
      }
      return { type: "submitVote", voterId, guessedAuthorId };
    }
    case "tryCompleteVotingEarly":
      return { type: "tryCompleteVotingEarly" };
    case "processReveal":
      return { type: "processReveal" };
    case "advanceToNextRound":
      return { type: "advanceToNextRound" };
    case "dismissLeaderboard":
      return { type: "dismissLeaderboard" };
    case "leaderboardTimerExpired":
      return { type: "leaderboardTimerExpired" };
    case "leaderFewMore":
      return { type: "leaderFewMore" };
    case "wrapUp":
      return { type: "wrapUp" };
    case "getResults":
      return { type: "getResults" };
    case "endSession":
      return { type: "endSession" };
    default:
      throw new Error(`Unknown actionType: ${actionType}`);
  }
}
