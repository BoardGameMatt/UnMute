export const GRID_COLS = 5;
export const GRID_ROWS = 7;
export const HALL_COL = 2;
export const HALL_ROW = 3;

export const OPENING_CROSS: ReadonlyArray<{ dir: "n" | "e" | "s" | "w"; col: number; row: number }> = [
  { dir: "n", col: 2, row: 2 },
  { dir: "e", col: 3, row: 3 },
  { dir: "s", col: 2, row: 4 },
  { dir: "w", col: 1, row: 3 },
];

export const IND_K = 3;
export const TEAM_K = 4;
export const GUESS_SECONDS = 60;
export const TEAM_INTRO_SECONDS = 30;
export const TEAM_DISCUSS_SECONDS = 120;
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 20;
export const MIN_INDIVIDUAL_BEFORE_TEAM = 2;
export const REQUIRED_INDIVIDUAL_ROUNDS = 3;
export const REQUIRED_TEAM_ROUNDS = 3;
export const LETTERS = ["A", "B", "C", "D"] as const;

export type ZoningRightsPhase =
  | "IND_PLANNER_PICK"
  | "IND_ZM_ASSIGN"
  | "IND_GUESS"
  | "IND_REVEAL"
  | "TEAM_INTRO"
  | "TEAM_PLANNER_PICK"
  | "TEAM_ZM_ASSIGN"
  | "TEAM_DISCUSS"
  | "TEAM_LOCK"
  | "TEAM_REVEAL"
  | "SCOREBOARD";

export type ZoningRightsMode = "individual" | "team";

export type ZoningRightsViewerRole =
  | "planner"
  | "zoning_manager"
  | "guesser"
  | "lead_developer"
  | "watcher";

export type Cell = { col: number; row: number };

export type LetteredLot = { letter: string; col: number; row: number };

export type BoardOccupant =
  | { kind: "hall" }
  | { kind: "building"; buildingId: string };

export type ZoningBoard = {
  occupants: Record<string, BoardOccupant>;
};

export type Assignment = Record<string, string>;

export type ZoningRightsAction =
  | { type: "selectLots"; cells: Cell[] }
  | { type: "lockLots"; cells?: Cell[] }
  | { type: "lockZmAssignment"; assignment: Assignment }
  | { type: "placeGuess"; assignment: Assignment }
  | { type: "lockGuess"; assignment?: Assignment }
  | { type: "timerExpired" }
  | { type: "continue" }
  | { type: "anotherRound" }
  | { type: "moveToTeamPlay" }
  | { type: "skipPlanner" }
  | { type: "placeTeamGuess"; assignment: Assignment }
  | { type: "lockTeam"; assignment?: Assignment }
  | { type: "complete" }
  | { type: "advanceRecap" };

export type BuildingView = {
  id: string;
  name: string;
};

export type OccupiedCellView = {
  col: number;
  row: number;
  kind: "hall" | "building";
  buildingId: string | null;
  name: string;
};

export type ZoningRightsPlayState = {
  phase: ZoningRightsPhase;
  mode: ZoningRightsMode;
  individualRoundIndex: number;
  teamRoundIndex: number;
  isLead: boolean;
  participantId: string;
  viewerRole: ZoningRightsViewerRole;
  instruction: string;
  progress: number;
  k: number;
  plannerName: string | null;
  zmName: string | null;
  leadDeveloperName: string | null;
  canPickLots: boolean;
  canAssignZm: boolean;
  canGuess: boolean;
  canTeamLock: boolean;
  canContinue: boolean;
  canAnotherRound: boolean;
  canMoveToTeamPlay: boolean;
  canWrapUp: boolean;
  lockedInCount: number;
  guesserCount: number;
  buildingsRemaining: number;
  occupied: OccupiedCellView[];
  legalLots: Cell[];
  selectedLots: Cell[];
  lots: LetteredLot[];
  buildings: BuildingView[];
  /** Secret: only for current ZM, or after reveal. */
  zmAssignment: Assignment | null;
  myGuess: Assignment | null;
  myGuessLocked: boolean;
  teamGuess: Assignment | null;
  exactMatchNames: string[];
  teamHit: boolean | null;
  timerStartedAt: string | null;
  timerSeconds: number | null;
};
