/**
 * Pure state transitions for I Know What You Meme — no React; safe on the server.
 */

import { OPEN_PROMPTS, STIMULUS_CATEGORIES } from "./prompts";
import type {
  IKWYMParticipant,
  IKWYMRevealItem,
  IKWYMRoundPrompts,
  IKWYMRoundResponse,
  IKWYMState,
  IKWYMStimulusCategory,
} from "./types";
import { IKWYM_PROTOCOL_VERSION } from "./types";

export const REVEAL_TIMER_MS = 30_000;

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function emptyScores(ids: string[]): Record<string, number> {
  return Object.fromEntries(ids.map((id) => [id, 0]));
}

function revealKey(revealIndex: number): string {
  return String(revealIndex);
}

function formatPromptLabel(round: 1 | 2, prompts: IKWYMRoundPrompts): string {
  return `Round ${round} · ${prompts.openPrompt} · ${prompts.stimulusCategory.label}`;
}

function pickUnusedOpenPrompt(used: string[]): string {
  const available = OPEN_PROMPTS.filter((p) => !used.includes(p));
  const pool = available.length > 0 ? available : OPEN_PROMPTS;
  return pool[Math.floor(Math.random() * pool.length)] as string;
}

function pickUnusedStimulus(usedLabels: string[]): IKWYMStimulusCategory {
  const available = STIMULUS_CATEGORIES.filter((c) => !usedLabels.includes(c.label));
  const pool = available.length > 0 ? available : STIMULUS_CATEGORIES;
  return pool[Math.floor(Math.random() * pool.length)] as IKWYMStimulusCategory;
}

function generateRoundPrompts(
  usedOpenPrompts: string[],
  usedStimulusCategories: string[]
): { prompts: IKWYMRoundPrompts; usedOpen: string[]; usedStimulus: string[] } {
  const openPrompt = pickUnusedOpenPrompt(usedOpenPrompts);
  const stimulusCategory = pickUnusedStimulus(usedStimulusCategories);
  return {
    prompts: { openPrompt, stimulusCategory },
    usedOpen: [...usedOpenPrompts, openPrompt],
    usedStimulus: [...usedStimulusCategories, stimulusCategory.label],
  };
}

function allParticipantsSubmitted(
  state: IKWYMState,
  responses: Record<string, IKWYMRoundResponse>
): boolean {
  return state.participants.every((p) => Boolean(responses[p.id]?.gifUrl));
}

function buildRevealQueue(state: IKWYMState): IKWYMRevealItem[] {
  const round1Ids = shuffle(Object.keys(state.round1Responses));
  const round2Ids = shuffle(Object.keys(state.round2Responses));
  const queue: IKWYMRevealItem[] = [];

  for (const id of round1Ids) {
    const resp = state.round1Responses[id];
    if (!resp) continue;
    queue.push({
      participantId: id,
      round: 1,
      gifUrl: resp.gifUrl,
      promptLabel: formatPromptLabel(1, state.round1Prompts),
    });
  }

  if (state.round2Prompts) {
    for (const id of round2Ids) {
      const resp = state.round2Responses[id];
      if (!resp) continue;
      queue.push({
        participantId: id,
        round: 2,
        gifUrl: resp.gifUrl,
        promptLabel: formatPromptLabel(2, state.round2Prompts),
      });
    }
  }

  return queue;
}

function currentRevealOwner(state: IKWYMState): string | null {
  return state.revealQueue[state.revealIndex]?.participantId ?? null;
}

function allGuessesSubmitted(state: IKWYMState): boolean {
  const ownerId = currentRevealOwner(state);
  if (!ownerId) return false;
  const key = revealKey(state.revealIndex);
  const roundGuesses = state.guesses[key] ?? {};
  return state.participants
    .filter((p) => p.id !== ownerId)
    .every((p) => typeof roundGuesses[p.id] === "string");
}

export function initIKWYM(participants: IKWYMParticipant[]): IKWYMState {
  if (participants.length < 3 || participants.length > 20) {
    throw new Error("Player count must be between 3 and 20.");
  }

  const ids = participants.map((p) => p.id);
  const { prompts, usedOpen, usedStimulus } = generateRoundPrompts([], []);

  return {
    version: IKWYM_PROTOCOL_VERSION,
    phase: "round1_prompts",
    participants,
    round1Prompts: prompts,
    round2Prompts: null,
    round1Responses: {},
    round2Responses: {},
    revealQueue: [],
    revealIndex: 0,
    guesses: {},
    scores: emptyScores(ids),
    timerStart: null,
    usedOpenPrompts: usedOpen,
    usedStimulusCategories: usedStimulus,
    roundResolved: false,
    revealedOwnerId: null,
    correctGuessers: [],
    session_complete: false,
  };
}

export function broadcastRound1(state: IKWYMState): IKWYMState {
  if (state.phase !== "round1_prompts") return state;
  return { ...state, phase: "round1_selecting" };
}

export function submitRound1Gif(
  state: IKWYMState,
  participantId: string,
  gifUrl: string,
  searchQuery: string,
  openResponse: string,
  stimulusResponse: string
): IKWYMState {
  if (state.phase !== "round1_selecting") return state;

  const round1Responses: Record<string, IKWYMRoundResponse> = {
    ...state.round1Responses,
    [participantId]: {
      gifUrl,
      searchQuery: searchQuery.trim(),
      openResponse: openResponse.trim(),
      stimulusResponse: stimulusResponse.trim(),
    },
  };

  let next: IKWYMState = { ...state, round1Responses };

  if (allParticipantsSubmitted(next, round1Responses)) {
    const generated = generateRoundPrompts(
      next.usedOpenPrompts,
      next.usedStimulusCategories
    );
    next = {
      ...next,
      phase: "round2_prompts",
      round2Prompts: generated.prompts,
      usedOpenPrompts: generated.usedOpen,
      usedStimulusCategories: generated.usedStimulus,
    };
  }

  return next;
}

export function broadcastRound2(state: IKWYMState): IKWYMState {
  if (state.phase !== "round2_prompts") return state;
  if (!state.round2Prompts) {
    throw new Error("Round 2 prompts not generated.");
  }
  return { ...state, phase: "round2_selecting" };
}

export function submitRound2Gif(
  state: IKWYMState,
  participantId: string,
  gifUrl: string,
  searchQuery: string,
  openResponse: string,
  stimulusResponse: string
): IKWYMState {
  if (state.phase !== "round2_selecting") return state;

  const round2Responses: Record<string, IKWYMRoundResponse> = {
    ...state.round2Responses,
    [participantId]: {
      gifUrl,
      searchQuery: searchQuery.trim(),
      openResponse: openResponse.trim(),
      stimulusResponse: stimulusResponse.trim(),
    },
  };

  let next: IKWYMState = { ...state, round2Responses };

  if (allParticipantsSubmitted(next, round2Responses)) {
    const revealQueue = buildRevealQueue(next);
    if (revealQueue.length === 0) {
      throw new Error("No GIF responses to reveal.");
    }
    next = {
      ...next,
      phase: "reveal",
      revealQueue,
      revealIndex: 0,
      timerStart: Date.now(),
      roundResolved: false,
      revealedOwnerId: null,
      correctGuessers: [],
      guesses: {},
    };
  }

  return next;
}

export function submitGuess(
  state: IKWYMState,
  participantId: string,
  guessedParticipantId: string,
  revealIndex: number
): IKWYMState {
  if (state.phase !== "reveal") return state;
  if (state.roundResolved) return state;
  if (revealIndex !== state.revealIndex) return state;

  if (participantId === guessedParticipantId) {
    throw new Error("You cannot guess yourself.");
  }

  const ownerId = currentRevealOwner(state);
  if (participantId === ownerId) {
    throw new Error("GIF owner cannot submit a guess.");
  }

  const key = revealKey(revealIndex);
  const roundGuesses = { ...(state.guesses[key] ?? {}) };
  roundGuesses[participantId] = guessedParticipantId;

  let next: IKWYMState = {
    ...state,
    guesses: { ...state.guesses, [key]: roundGuesses },
  };

  if (allGuessesSubmitted(next)) {
    next = resolveRound(next);
  }

  return next;
}

export function onGuessTimerExpired(state: IKWYMState): IKWYMState {
  if (state.phase !== "reveal" || state.roundResolved) return state;
  return resolveRound(state);
}

export function resolveRound(state: IKWYMState): IKWYMState {
  if (state.phase !== "reveal") return state;

  const ownerId = currentRevealOwner(state);
  if (!ownerId) return state;

  const key = revealKey(state.revealIndex);
  const roundGuesses = state.guesses[key] ?? {};
  const scores = { ...state.scores };
  const correctGuessers: string[] = [];

  for (const [voterId, guessedId] of Object.entries(roundGuesses)) {
    if (guessedId === ownerId) {
      scores[voterId] = (scores[voterId] ?? 0) + 1;
      correctGuessers.push(voterId);
    }
  }

  return {
    ...state,
    scores,
    roundResolved: true,
    revealedOwnerId: ownerId,
    correctGuessers,
    timerStart: null,
  };
}

export function nextReveal(state: IKWYMState): IKWYMState {
  if (state.phase !== "reveal" || !state.roundResolved) return state;

  const nextIndex = state.revealIndex + 1;
  if (nextIndex >= state.revealQueue.length) {
    return {
      ...state,
      phase: "complete",
      session_complete: true,
      timerStart: null,
    };
  }

  return {
    ...state,
    revealIndex: nextIndex,
    timerStart: Date.now(),
    roundResolved: false,
    revealedOwnerId: null,
    correctGuessers: [],
  };
}

export function computeScoreboard(
  state: IKWYMState
): Array<{ participantId: string; displayName: string; score: number }> {
  return [...state.participants]
    .map((p) => ({
      participantId: p.id,
      displayName: p.display_name,
      score: state.scores[p.id] ?? 0,
    }))
    .sort((a, b) => b.score - a.score);
}

export function endSession(state: IKWYMState): IKWYMState {
  return { ...state, phase: "complete", session_complete: true };
}

export type IKWYMEngineAction =
  | { type: "initializeGame"; participants: IKWYMParticipant[] }
  | { type: "broadcastRound1" }
  | {
      type: "submitRound1Gif";
      participantId: string;
      gifUrl: string;
      searchQuery: string;
      openResponse: string;
      stimulusResponse: string;
    }
  | { type: "broadcastRound2" }
  | {
      type: "submitRound2Gif";
      participantId: string;
      gifUrl: string;
      searchQuery: string;
      openResponse: string;
      stimulusResponse: string;
    }
  | {
      type: "submitGuess";
      participantId: string;
      guessedParticipantId: string;
      revealIndex: number;
    }
  | { type: "guessTimerExpired" }
  | { type: "resolveRound" }
  | { type: "nextReveal" }
  | { type: "endSession" };

export function reduceIKWYMState(
  state: IKWYMState | null,
  action: IKWYMEngineAction
): IKWYMState {
  switch (action.type) {
    case "initializeGame":
      return initIKWYM(action.participants);
    case "broadcastRound1":
      if (!state) throw new Error("IKWYM state not initialized");
      return broadcastRound1(state);
    case "submitRound1Gif":
      if (!state) throw new Error("IKWYM state not initialized");
      return submitRound1Gif(
        state,
        action.participantId,
        action.gifUrl,
        action.searchQuery,
        action.openResponse,
        action.stimulusResponse
      );
    case "broadcastRound2":
      if (!state) throw new Error("IKWYM state not initialized");
      return broadcastRound2(state);
    case "submitRound2Gif":
      if (!state) throw new Error("IKWYM state not initialized");
      return submitRound2Gif(
        state,
        action.participantId,
        action.gifUrl,
        action.searchQuery,
        action.openResponse,
        action.stimulusResponse
      );
    case "submitGuess":
      if (!state) throw new Error("IKWYM state not initialized");
      return submitGuess(
        state,
        action.participantId,
        action.guessedParticipantId,
        action.revealIndex
      );
    case "guessTimerExpired":
      if (!state) throw new Error("IKWYM state not initialized");
      return onGuessTimerExpired(state);
    case "resolveRound":
      if (!state) throw new Error("IKWYM state not initialized");
      return resolveRound(state);
    case "nextReveal":
      if (!state) throw new Error("IKWYM state not initialized");
      return nextReveal(state);
    case "endSession":
      if (!state) throw new Error("IKWYM state not initialized");
      return endSession(state);
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

export function clientPayloadToEngineAction(
  actionType: string,
  payload: Record<string, unknown>
): IKWYMEngineAction {
  switch (actionType) {
    case "initializeGame": {
      const participants = payload.participants;
      if (!Array.isArray(participants)) {
        throw new Error("initializeGame requires participants: array");
      }
      return {
        type: "initializeGame",
        participants: participants as IKWYMParticipant[],
      };
    }
    case "ikwym/broadcast_round1":
      return { type: "broadcastRound1" };
    case "ikwym/submit_round1_gif": {
      return parseGifSubmit(payload, "submitRound1Gif");
    }
    case "ikwym/broadcast_round2":
      return { type: "broadcastRound2" };
    case "ikwym/submit_round2_gif": {
      return parseGifSubmit(payload, "submitRound2Gif");
    }
    case "ikwym/submit_guess": {
      const participantId = payload.participantId;
      const guessedParticipantId = payload.guessedParticipantId;
      const revealIndex = payload.revealIndex;
      if (
        typeof participantId !== "string" ||
        typeof guessedParticipantId !== "string" ||
        typeof revealIndex !== "number"
      ) {
        throw new Error("ikwym/submit_guess requires participantId, guessedParticipantId, revealIndex");
      }
      return {
        type: "submitGuess",
        participantId,
        guessedParticipantId,
        revealIndex,
      };
    }
    case "ikwym/guess_timer_expired":
      return { type: "guessTimerExpired" };
    case "ikwym/resolve_round":
      return { type: "resolveRound" };
    case "ikwym/next_reveal":
      return { type: "nextReveal" };
    case "endSession":
      return { type: "endSession" };
    default:
      throw new Error(`Unknown actionType: ${actionType}`);
  }
}

function parseGifSubmit(
  payload: Record<string, unknown>,
  type: "submitRound1Gif" | "submitRound2Gif"
): IKWYMEngineAction {
  const participantId = payload.participantId;
  const gifUrl = payload.gifUrl;
  const searchQuery = payload.searchQuery;
  const openResponse = payload.openResponse;
  const stimulusResponse = payload.stimulusResponse;
  if (
    typeof participantId !== "string" ||
    typeof gifUrl !== "string" ||
    typeof searchQuery !== "string" ||
    typeof openResponse !== "string" ||
    typeof stimulusResponse !== "string"
  ) {
    throw new Error(`${type} requires participantId, gifUrl, searchQuery, openResponse, stimulusResponse`);
  }
  const base = {
    participantId,
    gifUrl,
    searchQuery,
    openResponse,
    stimulusResponse,
  };
  return type === "submitRound1Gif"
    ? { type: "submitRound1Gif", ...base }
    : { type: "submitRound2Gif", ...base };
}
