/**
 * Role-filtered views of a Truth Is game.
 * Pure: no database, safe in tests.
 */

import { computeRoundScores } from "./engine";
import {
  PERSISTENT_INSTRUCTION,
  type TruthIsPlayState,
  type TruthIsPublicPulse,
  type TruthIsRevealView,
  type TruthIsState,
} from "./types";

const LIVE_TEXT = new Set(["DISCUSSION", "VOTING", "REVEAL"]);

function nameOf(state: TruthIsState, id: string | null): string | null {
  if (!id) return null;
  return state.participants.find((p) => p.id === id)?.display_name ?? "Player";
}

function progressOf(state: TruthIsState): number {
  if (state.progress_total_rounds <= 0) return 0;
  return Math.min(1, state.total_rounds_played / state.progress_total_rounds);
}

function currentEntry(state: TruthIsState) {
  if (!state.current_entry_id) return null;
  return state.entries.find((e) => e.id === state.current_entry_id) ?? null;
}

function revealView(state: TruthIsState): TruthIsRevealView | null {
  if (state.phase !== "REVEAL") return null;
  const entry = currentEntry(state);
  const authorName = nameOf(state, state.current_author_id);
  if (!entry || !authorName || !state.current_author_id) return null;

  const scores = computeRoundScores(state);
  const isBluff =
    state.current_reader_id !== null && state.current_reader_id === state.current_author_id;

  const votes = Object.entries(state.votes_this_round).map(([voterId, guessedId]) => ({
    voterName: nameOf(state, voterId) ?? "Player",
    guessedName: nameOf(state, guessedId) ?? "Player",
  }));

  const nameList = (ids: string[]) => ids.map((id) => nameOf(state, id) ?? "Player");

  return {
    authorName,
    entryText: entry.text,
    isBluff,
    votes,
    authorBluffed: scores.authorBluffed,
    authorPoints: scores.authorPointsEarned,
    fooledNames: nameList(scores.fooledVoterIds),
    caughtNames: nameList(scores.caughtVoterIds),
    correctGuesserNames: nameList(
      Object.entries(state.votes_this_round)
        .filter(([voterId, guessed]) => voterId !== state.current_author_id && guessed === state.current_author_id)
        .map(([voterId]) => voterId)
    ),
  };
}

function mostSurprising(state: TruthIsState): TruthIsPlayState["mostSurprising"] {
  if (state.phase !== "RESULTS" || !state.most_surprising_entry_id) return null;
  const entry = state.entries.find((e) => e.id === state.most_surprising_entry_id);
  if (!entry) return null;
  return {
    text: entry.text,
    authorName: nameOf(state, entry.author_id) ?? "Player",
  };
}

export function toPlayState(
  state: TruthIsState,
  participantId: string,
  isLead: boolean,
  ended = false
): TruthIsPlayState {
  const entry = currentEntry(state);
  const showLiveText = LIVE_TEXT.has(state.phase);
  const youAreReader = state.current_reader_id === participantId;
  const youAreAuthor =
    youAreReader &&
    state.current_author_id !== null &&
    state.current_reader_id === state.current_author_id;

  const submissionRound =
    state.phase === "SUBMISSION_1" ? 1 : state.phase === "SUBMISSION_2" ? 2 : null;

  let mySubmittedText: string | null = null;
  let mySubmissionDone = false;
  if (submissionRound) {
    const mine = state.entries.find(
      (e) => e.author_id === participantId && e.round_submitted === submissionRound
    );
    const skip = state.skipped_rounds[participantId];
    const skipped = submissionRound === 1 ? skip?.r1 === true : skip?.r2 === true;
    mySubmittedText = mine?.text ?? null;
    mySubmissionDone = Boolean(mine) || skipped;
  }

  const instruction =
    state.phase === "DISCUSSION" || state.phase === "VOTING" ? PERSISTENT_INSTRUCTION : "";

  return {
    phase: state.phase,
    participants: state.participants.map((p) => ({
      id: p.id,
      displayName: p.display_name,
    })),
    scores: [...state.participants]
      .map((p) => ({
        id: p.id,
        displayName: p.display_name,
        score: state.scores[p.id] ?? 0,
      }))
      .sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName)),
    currentRound: state.current_round,
    totalRoundsPlayed: state.total_rounds_played,
    minimumRounds: state.minimum_rounds,
    progress: progressOf(state),
    timerStartedAt: state.timer_started_at,
    timerDurationSeconds: state.timer_duration_seconds,
    submissionRound,
    mySubmittedText,
    mySubmissionDone,
    currentEntryId: showLiveText ? state.current_entry_id : null,
    currentEntryText: showLiveText ? (entry?.text ?? null) : null,
    currentReaderId: state.current_reader_id,
    currentReaderName: nameOf(state, state.current_reader_id),
    youAreReader,
    youAreAuthor,
    myGuessId: state.votes_this_round[participantId] ?? null,
    entriesRemaining: state.entries.filter((e) => !e.used).length,
    reveal: revealView(state),
    mostSurprising: mostSurprising(state),
    isLead,
    ended,
    instruction,
  };
}

export function toPublicPulse(state: TruthIsState, nowMs = Date.now()): TruthIsPublicPulse {
  const entry = currentEntry(state);
  const showLiveText = LIVE_TEXT.has(state.phase);
  return {
    v: 1,
    phase: state.phase,
    timerStartedAt: state.timer_started_at,
    timerDurationSeconds: state.timer_duration_seconds,
    currentRound: state.current_round,
    totalRoundsPlayed: state.total_rounds_played,
    progress: progressOf(state),
    currentReaderId: state.current_reader_id,
    currentEntryText: showLiveText ? (entry?.text ?? null) : null,
    t: nowMs,
  };
}
