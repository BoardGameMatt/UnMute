export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 20;

export type RankAndFilePhase = "lobby" | "write" | "rank" | "reveal" | "scoreboard";

export type RankAndFileEndReason = "commit" | "zero_tiles" | "abandoned";

export type RankAndFileAction =
  | { type: "lockClue"; text: string }
  | { type: "timerExpired" }
  | { type: "setRail"; dealIds: (string | null)[] }
  | { type: "commit" }
  | { type: "nextRound" }
  | { type: "anotherRound" }
  | { type: "wrap" }
  | { type: "advanceRecap" };

export type ViewerRole = "clueGiver" | "spectator" | "display";

export type RosterChip = {
  participantId: string;
  displayName: string;
  locked: boolean;
  isClueGiver: boolean;
};

export type RankTile = {
  dealId: string;
  clueText: string;
  displayName: string;
  dealtNumber: number | null;
};

export type RankAndFilePlayState = {
  phase: RankAndFilePhase;
  isLead: boolean;
  isDisplay: boolean;
  participantId: string;
  viewerRole: ViewerRole;
  instruction: string;
  persistentInstruction: string;
  progress: number;
  roundIndex: number;
  hits: number;
  committedRounds: number;
  percentInOrder: number;
  lockedCount: number;
  clueGiverCount: number;
  roster: RosterChip[];
  writeStartedAt: string | null;
  rankStartedAt: string | null;
  timerSeconds: number | null;
  remainingSubjects: number;
  canRank: boolean;
  canCommit: boolean;
  canNextRound: boolean;
  canAnotherRound: boolean;
  canWrap: boolean;
  canAdvanceRecap: boolean;
  myClueLocked: boolean;
  clueError: string | null;
  /** Clue giver phone only during write. Stripped for spectators and display. */
  dealtNumber: number | null;
  theme: string | null;
  lowEnd: string | null;
  highEnd: string | null;
  tray: RankTile[];
  /** Rank slots, left to right. `null` is an empty space on the top row. */
  rail: (RankTile | null)[];
  truthRow: RankTile[] | null;
  isHit: boolean | null;
  zeroTiles: boolean;
};
