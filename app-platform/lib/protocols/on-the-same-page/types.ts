import type { PieceColor, ReactionKind, TileId } from "./config";
import type { Family } from "./pictures";

export type Role = "builder" | "improviser" | "inspector";

export type OtspPhase = "deal" | "build" | "checkin" | "final_lock" | "reveal" | "scoreboard";

export type RevealStep = "suspicion" | "improviser" | "guess" | "picture" | "replay" | "outcome";

export type GuessBand = 1 | 2 | 3 | 4 | 5;

export type Placement =
  | {
      passed: false;
      participantId: string;
      tile: TileId;
      row: number;
      col: number;
      lap: number;
      turn: number;
    }
  | {
      passed: true;
      participantId: string;
      lap: number;
      turn: number;
    };

export type Guess = {
  itemId: string;
  band: GuessBand;
};

export type PublicReaction = {
  id: string;
  kind: ReactionKind;
  at: number;
};

export type RoundState = {
  number: number;
  seed: number;
  pictureId: string;
  family: Family;
  guessIds: string[];
  roles: Record<string, Role>;
  placers: string[];
  improviserId: string;
  colors: Record<string, PieceColor>;
  cursor: number;
  placements: Placement[];
  preview: { tile: TileId; row: number; col: number } | null;
  guesses: Record<string, Guess>;
  /** Missing means never pinned. Null means cleared. */
  pins: Record<string, string | null>;
  lastReactionAt: Record<string, number>;
  reactions: PublicReaction[];
  reactionSeq: number;
  endAfterCheckin: boolean;
  endAfterTurn: boolean;
  endReason: "early" | "lap5" | null;
  phaseEndsAt: number;
  phaseDurationMs: number;
  revealStep: RevealStep;
  scored: boolean;
  totalsApplied: boolean;
  roundPoints: Record<string, number>;
  readPicture: number;
  readPerson: number;
};

export type RoundMetric = {
  round: number;
  readPicture: number;
  readPerson: number;
};

export type OtspGame = {
  seed: number;
  playerIds: string[];
  drawnIds: string[];
  improviserOrder: string[];
  usedPictureIds: string[];
  lastFamily: Family | null;
  totals: Record<string, number>;
  roundNumber: number;
  phase: OtspPhase;
  round: RoundState;
  metrics: RoundMetric[];
};

export type EngineEvent = {
  type: string;
  actorId: string | null;
  role: Role | null;
  payload: Record<string, unknown>;
};

export type EngineAction =
  | { type: "expire" }
  | { type: "preview"; tile: TileId; row: number; col: number }
  | { type: "place"; tile: TileId; row: number; col: number }
  | { type: "guess"; itemId: string }
  | { type: "pin"; targetId: string | null }
  | { type: "react"; kind: ReactionKind; tileKey: string | null }
  | { type: "anotherRound" }
  | { type: "scoreboard" };

export type ActorAction = EngineAction & { actorId: string };

export type ScoreBreakdown = {
  points: Record<string, number>;
  readPicture: number;
  readPerson: number;
  pinsOnImproviser: number;
  inspectorCorrect: number;
  inspectorCount: number;
};

export type PlacerView = {
  id: string;
  name: string;
  color: PieceColor | null;
  passed: boolean;
  active: boolean;
};

export type PlacementView = {
  row: number;
  col: number;
  tile: TileId;
  participantId: string;
  color: PieceColor | null;
};

export type OtspPlayState = {
  phase: OtspPhase;
  roundNumber: number;
  lap: number;
  phaseEndsAt: number;
  phaseDurationMs: number;
  placers: PlacerView[];
  placements: PlacementView[];
  preview: { tile: TileId; row: number; col: number } | null;
  guessList: { id: string; label: string }[];
  myRole: Role | null;
  selfId: string | null;
  pictureLabel: string | null;
  headerTitle: string;
  headerBody: string;
  lockCount: number;
  inspectorCount: number;
  myGuessId: string | null;
  myPinId: string | null;
  canGuess: boolean;
  canPin: boolean;
  canReact: boolean;
  isMyTurn: boolean;
  reactions: PublicReaction[];
  revealStep: RevealStep;
  suspicion: { id: string; name: string; count: number }[];
  improviserId: string | null;
  improviserName: string | null;
  improviserGuessLabel: string | null;
  readPicture: number | null;
  readPerson: number | null;
  totals: { id: string; name: string; roundPoints: number; total: number }[];
  showTotals: boolean;
  canControl: boolean;
  bridge: string;
  monochrome: boolean;
};

export type OtspClientState = OtspPlayState & {
  serverNow: number;
  sessionId: string;
};
