import type { SayLessCategoryId, SayLessEndReason, SayLessPhase, SayLessTeamLabel } from "./engine";

export type SayLessViewerRole = "clue" | "guess" | "listen";

export type SayLessAction = (
  | { type: "setCategories"; categories: [SayLessCategoryId, SayLessCategoryId] }
  | { type: "swapPlayers"; a: string; b: string }
  | { type: "confirmTeams" }
  | { type: "startRound" }
  | { type: "cardAction"; outcome: "got_it" | "pass"; cardId: string; operationId?: string; turnId?: string | null; expectedVersion?: number }
  | { type: "skipTurn" }
  | { type: "pauseHold" }
  | { type: "resumeHold" }
  | { type: "endRound" }
  | { type: "advance" }
  | { type: "complete" }
) & { expectedVersion?: number; turnId?: string | null };

export type SayLessMemberView = {
  id: string;
  displayName: string;
};

export type SayLessTeamView = {
  id: string;
  label: SayLessTeamLabel;
  name: string;
  members: SayLessMemberView[];
  isYours: boolean;
};

export type SayLessCardView = {
  id: string;
  name: string;
  hint: string | null;
};

export type SayLessTeamScore = {
  label: SayLessTeamLabel;
  name: string;
  score: number;
};

export type SayLessPlayState = {
  phase: SayLessPhase;
  round: 1 | 2;
  turnId: string | null;
  version: number;
  isLead: boolean;
  participantId: string;
  viewerRole: SayLessViewerRole | null;
  instruction: string;
  roleLine: string | null;
  progress: number;
  categories: { id: SayLessCategoryId; label: string }[];
  teams: SayLessTeamView[];
  cardsLeft: number;
  cardsGotThisTurn: number | null;
  clueGiverName: string | null;
  guesserNames: string[];
  nextClueGiverName: string | null;
  currentCard: SayLessCardView | null;
  previewCards: SayLessCardView[] | null;
  deadlineAt: string | null;
  startedAt: string | null;
  paused: boolean;
  lastEndReason: SayLessEndReason | null;
  turnsThisRound: number;
  /** Round 1 scores on ROUND_BREAK; totals across both rounds on FINAL_SCORES. */
  scores: SayLessTeamScore[] | null;
  winner: SayLessTeamLabel | "tie" | null;
  hostLine: string | null;
  canSkipTurn: boolean;
  canActOnCard: boolean;
};
