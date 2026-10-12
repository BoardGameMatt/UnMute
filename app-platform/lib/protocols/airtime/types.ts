export type AirtimePhase =
  | "lobby"
  | "boats"
  | "rules"
  | "dive_active"
  | "dive_results"
  | "final";

export type Choice = "deeper" | "up";

export type DiverStatus = "underwater" | "surfaced" | "lost" | "forfeit";

export type DiveEndReason = "all_back" | "max_turns" | "facilitator";

export type GaugeBand = "plenty" | "half" | "low" | "critical";

export type DiverState = {
  participantId: string;
  boatId: string;
  /** 0 once surfaced. */
  depth: number;
  deepest: number;
  itemId: string;
  /** Depth after each resolved turn. */
  path: number[];
  status: DiverStatus;
  surfacedTurn: number | null;
  haul: number;
};

export type BoatDiveState = {
  boatId: string;
  tankStart: number;
  tank: number;
  tankByTurn: number[];
  /** Remaining card ids per level ("1".."6"), drawn from the front. */
  decks: Record<string, string[]>;
};

export type DiveState = {
  turn: number;
  boats: BoatDiveState[];
  divers: DiverState[];
};

export type AirtimeEvent =
  | {
      type: "choice";
      turn: number;
      payload: {
        participant_id: string;
        boat_id: string;
        choice: Choice;
        timed_out: boolean;
        depth_before: number;
        depth_after: number;
        margin_at_choice: number;
        crew_present: boolean;
      };
    }
  | {
      type: "surfaced";
      turn: number;
      payload: { participant_id: string; boat_id: string; haul: number };
    }
  | {
      type: "air_drain";
      turn: number;
      payload: {
        boat_id: string;
        amount: number;
        tank_after: number;
        air_needed_now: number;
        margin: number;
      };
    }
  | {
      type: "out_of_air";
      turn: number;
      payload: { boat_id: string; lost_participant_ids: string[]; lost_hauls: number[] };
    }
  | {
      type: "forfeit";
      turn: number;
      payload: { boat_id: string; participant_ids: string[] };
    }
  | { type: "dive_end"; turn: number; payload: { end_reason: DiveEndReason } }
  | { type: "reveal"; turn: number; payload: { after_dive: number } }
  | { type: "facilitator_action"; turn: number; payload: { action: string } };

/** Event as stored: every row carries its dive number. */
export type StoredAirtimeEvent = AirtimeEvent & { dive: number };

export type TurnResult = {
  state: DiveState;
  events: AirtimeEvent[];
  ended: boolean;
  endReason: DiveEndReason | null;
};

// ---------------------------------------------------------------------------
// Actions

export type AirtimeAction =
  | { type: "choose"; choice: Choice; turn: number }
  | { type: "timerExpired" }
  | { type: "swap"; a: string; b: string }
  | { type: "showRules" }
  | { type: "startDive" }
  | { type: "endAfterTurn" }
  | { type: "nextDive" }
  | { type: "finalScore" }
  | { type: "advanceRecap" };

// ---------------------------------------------------------------------------
// Play state (role-filtered; built server-side per viewer)

export type ViewerRole = "display" | "diver" | "crew" | "waiting" | "boat" | "spectator";

export type PublicMember = { participantId: string; displayName: string };

export type PublicBoat = {
  id: string;
  name: string;
  members: PublicMember[];
};

export type ItemView = {
  id: string;
  name: string;
  level: number;
  /** Null while the diver is underwater. */
  value: number | null;
};

export type DiverView = {
  depth: number;
  deepest: number;
  status: DiverStatus;
  item: ItemView;
  chosen: Choice | null;
  canDeeper: boolean;
  gauge: { band: GaugeBand; label: string; segments: number };
  boatmates: { participantId: string; displayName: string; status: DiverStatus }[];
};

export type CrewRow = {
  participantId: string;
  displayName: string;
  status: DiverStatus;
  depth: number;
  airPerTurn: number;
  airToSurface: number;
};

export type CrewView = {
  tank: number;
  tankStart: number;
  airNeeded: number;
  margin: number;
  rows: CrewRow[];
};

export type HaulRow = {
  participantId: string;
  displayName: string;
  boatId: string;
  itemId: string;
  itemName: string;
  level: number;
  value: number;
  status: Exclude<DiverStatus, "underwater">;
  lostValue: number | null;
};

export type StandingRow = {
  boatId: string;
  name: string;
  isRival: boolean;
  diveTotals: number[];
  total: number;
  isWinner: boolean;
  members: { participantId: string; displayName: string; personalTotal: number }[];
};

export type AirtimePlayState = {
  sessionId: string;
  phase: AirtimePhase;
  viewerRole: ViewerRole;
  isDisplay: boolean;
  /** Lead actions allowed (the Shared screen, or a lead device without one). */
  canControl: boolean;
  serverNow: string;
  progress: number;

  diveNumber: number;
  maxDives: number;
  turn: number;
  maxTurns: number;
  windowOpensAt: string | null;
  turnSeconds: number;
  rulesStartedAt: string | null;
  rulesSeconds: number;
  endBannerUntil: string | null;
  endAfterTurn: boolean;
  revealed: boolean;

  boats: PublicBoat[];
  myBoatId: string | null;
  me: PublicMember | null;
  playerCount: number;

  diver: DiverView | null;
  crew: CrewView | null;
  /** My own item once banked, lost, or forfeited this dive. */
  myResult: HaulRow | null;

  results: {
    dive: number;
    hauls: HaulRow[];
  } | null;

  final: {
    standings: StandingRow[];
    winnerIds: string[];
  } | null;
};
