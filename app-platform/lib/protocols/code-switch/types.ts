import type { RoundType, ShownStat } from "./engine";

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 20;

export type CodeSwitchPhase = "lobby" | "write" | "guess" | "reveal" | "scoreboard";

export type CodeSwitchEndReason = "guessed" | "timer" | "abandoned";

export type CodeSwitchAction =
  | { type: "lockClue"; text: string }
  | { type: "lockGuess"; text: string }
  | { type: "timerExpired" }
  | { type: "anotherRound" }
  | { type: "wrap" }
  | { type: "advanceRecap" };

export type ViewerRole = "guesser" | "clueGiver" | "display";

export type RosterChip = {
  participantId: string;
  displayName: string;
  locked: boolean;
};

export type ClueBreakdownRow = {
  displayName: string;
  text: string;
  survived: boolean;
  isMine: boolean;
};

export type CodeSwitchPlayState = {
  phase: CodeSwitchPhase;
  isLead: boolean;
  isDisplay: boolean;
  participantId: string;
  viewerRole: ViewerRole;
  instruction: string;
  persistentInstruction: string;
  progress: number;
  roundIndex: number;
  teamScore: number;
  guesserName: string;
  lockedCount: number;
  clueGiverCount: number;
  roster: RosterChip[];
  writeStartedAt: string | null;
  guessStartedAt: string | null;
  timerSeconds: number | null;
  remainingWords: number;
  canAnotherRound: boolean;
  canWrap: boolean;
  canAdvanceRecap: boolean;
  myClueLocked: boolean;
  myGuessLocked: boolean;
  clueError: string | null;
  /** Clue givers only during write. Stripped for guesser and display. */
  word: string | null;
  /** Clue givers only during write. Never on guesser or display. */
  roundType: RoundType | null;
  filteredClues: string[];
  targetWord: string | null;
  guessText: string | null;
  isHit: boolean | null;
  breakdown: ClueBreakdownRow[] | null;
  shownLeaderboard: ShownStat[];
  shownTheMostName: string | null;
  rateLeaderName: string | null;
};
