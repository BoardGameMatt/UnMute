export type CoverStoryPhase =
  | "lobby"
  | "reading"
  | "discuss"
  | "insights"
  | "deal"
  | "field"
  | "reveal"
  | "complete";

export type CoverStoryRevealSubphase =
  | "mission"
  | "guess"
  | "gallery"
  | "mark"
  | "board"
  | "points"
  | "final";

export type CoverStoryWordLogStatus = "open" | "planted" | "not_planted";

export type CoverStoryMember = {
  id: string;
  displayName: string;
  isLead: boolean;
};

export type CoverStoryWordView = {
  wordId: string;
  phrase: string;
  difficulty: number;
  status: CoverStoryWordLogStatus;
  plantedOn: string | null;
  witnessIds: string[];
  note: string;
};

export type CoverStoryCardView = {
  agencyId: number;
  name: string;
  words: string[];
};

export type CoverStoryPlayState = {
  phase: CoverStoryPhase;
  revealOn: string | null;
  isLead: boolean;
  participantId: string;
  members: CoverStoryMember[];
  remainingUnshown: number;
  reading: {
    screenIndex: number;
    done: boolean;
    others: {
      id: string;
      displayName: string;
      screenIndex: number;
      done: boolean;
    }[];
    playbackIndex: number;
    insightsOn: boolean;
    independent: boolean;
    allDone: boolean;
  };
  deal: {
    cards: CoverStoryCardView[] | null;
    locked: boolean;
    lockedAgencyName: string | null;
    words: CoverStoryWordView[];
    copyPaste: string;
  } | null;
  field: {
    plantedCount: number;
    words: CoverStoryWordView[];
    witnesses: CoverStoryMember[];
  } | null;
  leadField: {
    id: string;
    displayName: string;
    locked: boolean;
    plantedCount: number;
    missionSubmitted: boolean;
  }[];
  reveal: {
    subphase: CoverStoryRevealSubphase;
    target: CoverStoryMember | null;
    guessStartedAt: string | null;
    guessDurationSeconds: number;
    myGuess: {
      agencyText: string;
      evidenceText: string;
      submitted: boolean;
    } | null;
    submittedCount: number;
    guesserCount: number;
    guessRoster: { id: string; displayName: string; submitted: boolean }[];
    missionSubmitted: boolean;
    missionRoster: { id: string; displayName: string; submitted: boolean }[];
    gallery: { agencyText: string; evidenceText: string; guesserName?: string }[];
    marks: {
      guessId: string;
      agencyText: string;
      evidenceText: string;
      guesserName: string;
      suggestedCorrect: boolean;
      markedCorrect: boolean | null;
    }[];
    board: {
      agencyName: string;
      words: {
        phrase: string;
        planted: boolean;
        plantedOn: string | null;
        note: string;
        witnessNames: string[];
      }[];
    } | null;
    points: {
      agentName: string;
      type1: number;
      mission: number;
      guessers: { name: string; delta: number }[];
    } | null;
    final: {
      id: string;
      name: string;
      type1: number;
      type2: number;
      mission: number;
      total: number;
    }[];
  } | null;
};

export type CoverStoryPublicState = {
  phase: CoverStoryPhase;
  playbackIndex: number;
  insightsOn: boolean;
  readers: Record<string, { screenIndex: number; done: boolean }>;
};

export const COVER_STORY_GUESS_SECONDS = 90;
export const COVER_STORY_AGENCY_MAX = 50;
export const COVER_STORY_EVIDENCE_MAX = 250;
export const COVER_STORY_NOTE_MAX = 50;
export const COVER_STORY_MISSION_POINTS = 15;
export const COVER_STORY_HAND_SIZE = 3;
/** Members besides the facilitator. The lead also plays. */
export const COVER_STORY_MIN_PLAYERS = 2;
export const COVER_STORY_MAX_PLAYERS = 15;

export type CoverStoryAction =
  | { type: "setRevealDate"; revealOn: string }
  | { type: "startReading" }
  | { type: "setReadingProgress"; screenIndex: number; done: boolean }
  | { type: "forceAdvanceReader"; participantId: string }
  | { type: "gateDiscussion" }
  | { type: "setPlayback"; playbackIndex: number; insightsOn?: boolean }
  | { type: "openInsights" }
  | { type: "openDeal" }
  | { type: "ensureDeal" }
  | { type: "lockAgency"; agencyId: number }
  | { type: "openField" }
  | {
      type: "submitMissionReport";
      words: {
        wordId: string;
        status: "planted" | "not_planted";
        plantedOn?: string;
        witnessIds?: string[];
        note?: string;
      }[];
    }
  | { type: "admitLate"; displayName: string }
  | { type: "startReveal" }
  | { type: "beginGuessing" }
  | { type: "submitGuess"; agencyText: string; evidenceText: string }
  | { type: "closeGuessWindow" }
  | { type: "revealCover" }
  | { type: "openScoring" }
  | { type: "setMarks"; marks: { guessId: string; markedCorrect: boolean }[] }
  | { type: "finalizeTarget" }
  | { type: "showPoints" }
  | { type: "nextTarget" }
  | { type: "skipTarget" }
  | { type: "scoreWithoutStory" }
  | { type: "showFinal" }
  | { type: "completeSession" };

