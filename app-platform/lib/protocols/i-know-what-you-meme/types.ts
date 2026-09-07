export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 20;
export const GUESS_SECONDS = 30;
export const RESPONSE_MAX = 120;

export type IkwymPhase =
  | "R1_PROMPTS"
  | "R1_SELECTING"
  | "R2_PROMPTS"
  | "R2_SELECTING"
  | "REVEAL_GUESS"
  | "REVEAL_SHOW"
  | "SCOREBOARD";

export type IkwymAction =
  | { type: "broadcastRound" }
  | {
      type: "confirmGif";
      gifUrl: string;
      openResponse: string;
      stimulusResponse: string;
      searchQuery: string;
    }
  | { type: "lockGuess"; guessedParticipantId: string }
  | { type: "timerExpired" }
  | { type: "nextReveal" }
  | { type: "wrap" }
  | { type: "advanceRecap" };

export type RosterChip = {
  participantId: string;
  displayName: string;
  submitted: boolean;
};

export type GuessOption = {
  participantId: string;
  displayName: string;
};

export type ScoreRow = {
  participantId: string;
  displayName: string;
  score: number;
};

export type IkwymPlayState = {
  phase: IkwymPhase;
  isLead: boolean;
  participantId: string;
  instruction: string;
  persistentInstruction: string;
  progress: number;
  round: 1 | 2;
  checkinPrompt: string;
  stimulusLabel: string;
  stimulusPrompt: string;
  confirmedCount: number;
  connectedCount: number;
  roster: RosterChip[];
  myGifUrl: string | null;
  hasConfirmed: boolean;
  currentGifUrl: string | null;
  currentPromptLabel: string | null;
  revealIndex: number;
  revealTotal: number;
  isOwner: boolean;
  guessOptions: GuessOption[];
  myGuessId: string | null;
  myGuessLocked: boolean;
  ownerName: string | null;
  correctGuesserNames: string[];
  timerStartedAt: string | null;
  timerSeconds: number | null;
  lockedInCount: number;
  eligibleCount: number;
  canBroadcast: boolean;
  canNext: boolean;
  canWrap: boolean;
  canAdvanceRecap: boolean;
  scores: ScoreRow[];
};
