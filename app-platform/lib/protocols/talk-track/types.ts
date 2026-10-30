export type TalkTrackPhase =
  | "lobby"
  | "team_reveal"
  | "turn"
  | "hold"
  | "another_round"
  | "final_scores";

export type TalkTrackSubphase = "cluing" | "guessing";

export type TalkTrackViewerRole = "guesser" | "train" | "spectator";

export type TalkTrackWordOutcome = "scored" | "passed" | "expired" | "unset";

export type TalkTrackEndReason = "all_five" | "timer" | "abandoned" | "skipped";

export type TalkTrackAction =
  | { type: "advanceHold" }
  | { type: "pauseHold" }
  | { type: "resumeHold" }
  | { type: "stop" }
  | { type: "resolve"; outcome: "got_it" | "pass" }
  | { type: "timerExpired" }
  | { type: "nudge"; teamId: string; delta: 1 | -1 }
  | { type: "anotherRound"; yes: boolean }
  | { type: "complete" };

export type TalkTrackMemberView = {
  id: string;
  displayName: string;
  isStarter: boolean;
};

export type TalkTrackWordView = {
  slot: number;
  text: string;
  outcome: TalkTrackWordOutcome;
  points: number;
};

export type TalkTrackTeamView = {
  id: string;
  name: string;
  memberNames: string[];
  score: number;
  isYours: boolean;
};

export type TalkTrackPlayState = {
  phase: TalkTrackPhase;
  cycleIndex: number;
  isLead: boolean;
  participantId: string;
  viewerRole: TalkTrackViewerRole;
  instruction: string;
  spectatorInstruction: string | null;
  progress: number;
  scoresVisible: boolean;
  teams: TalkTrackTeamView[];
  remainingCards: number;
  paused: boolean;
  hold:
    | {
        reason: TalkTrackEndReason | "reveal";
        turnPoints: number | null;
        holdStartedAt: string;
      }
    | null;
  turn: {
    id: string;
    teamName: string;
    guesserName: string;
    train: TalkTrackMemberView[];
    slot: number;
    subphase: TalkTrackSubphase;
    startedAt: string | null;
    words: TalkTrackWordView[] | null;
    canStop: boolean;
    canResolve: boolean;
    isDemo: boolean;
  } | null;
  canDealAnotherCycle: boolean;
};
