/**
 * Pure state transitions for Draw It By Ear — no React; safe to run on the server.
 */

import type {
  DibeCriterion,
  DibeImageCatalogEntry,
  DibeParticipant,
  DibePhase,
  DibeSessionLength,
  DibeState,
  DibeTeam,
  DibeTeamRoundStart,
} from "./types";
import { DIBE_PROTOCOL_VERSION } from "./types";

const TUTORIAL_IMAGE_NAME = "RoboDoc";

/** Countdown shown in a breakout room after its describer presses Go. */
export const BREAKOUT_COUNTDOWN_SECONDS = 3;

const ROUND_DRAWING_SECONDS = 90;
const SHOW_DRAWINGS_SECONDS = 45;

const TEAM_NAMES = [
  "The Picassos",
  "Team Van Gogh",
  "DaVinci Collective",
  "O'Keefe Originals",
  "Frida Collective",
  "Warhol Workshop",
  "Michelangelo Masters",
  "Basquiat Brigade",
  "The Hokusai Crew",
] as const;

const TEAM_COLORS = [
  "#F5A623",
  "#2ECC9A",
  "#6C5CE7",
  "#E84393",
  "#FF6B35",
  "#1A2744",
  "#00B4D8",
  "#2D6A4F",
  "#C77DFF",
] as const;

const SCORED_ROUND_IMAGE_NAMES = [
  "HatMan",
  "Working Out",
  "Dropping In For Lunch",
  "Mountain Hike",
  "PastaToGo",
] as const;

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `dibe_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)] as T;
}

function scoredRoundCount(length: DibeSessionLength): number {
  return length === "FULL" ? 5 : 3;
}

function shouldShowLeaderboard(length: DibeSessionLength, roundJustFinished: number): boolean {
  if (length === "FULL") {
    return roundJustFinished === 1 || roundJustFinished === 3 || roundJustFinished === 5;
  }
  return roundJustFinished === 1 || roundJustFinished === 3;
}

function withTimer(
  state: DibeState,
  seconds: number,
  resetScoring = false
): DibeState {
  return {
    ...state,
    timer_started_at: nowIso(),
    timer_duration_seconds: seconds,
    ...(resetScoring ? { scoring_submissions: {} } : {}),
  };
}

function emptyScores(ids: string[]): Record<string, number> {
  return Object.fromEntries(ids.map((id) => [id, 0]));
}

/** Tolerates state persisted before per-room round gating existed. */
function teamRoundStarts(state: DibeState): Record<string, DibeTeamRoundStart> {
  return state.team_round_starts ?? {};
}

function sortCriteria(criteria: DibeCriterion[]): DibeCriterion[] {
  return [...criteria].sort((a, b) => a.points - b.points);
}

function criteriaForPoints(criteria: DibeCriterion[], points: 1 | 2 | 3): DibeCriterion[] {
  return sortCriteria(criteria).filter((c) => c.points === points);
}

function findRoboDoc(catalog: DibeImageCatalogEntry[]): DibeImageCatalogEntry {
  const robo = catalog.find((i) => i.name === TUTORIAL_IMAGE_NAME);
  if (!robo) {
    throw new Error("Tutorial image RoboDoc not found in catalog.");
  }
  return robo;
}

/** Max 4 per team; even sizes; prefer larger groups; min 2 per team when multiple teams. */
export function computeTeamSizes(participantCount: number): number[] {
  if (participantCount < 3) {
    throw new Error("Draw It By Ear needs at least 3 players.");
  }

  if (participantCount <= 4) {
    return [participantCount];
  }

  let teamCount = Math.ceil(participantCount / 4);
  const maxTeams = Math.floor(participantCount / 2);

  while (teamCount <= maxTeams) {
    const base = Math.floor(participantCount / teamCount);
    const remainder = participantCount % teamCount;
    const sizes: number[] = [];
    for (let i = 0; i < teamCount; i++) {
      sizes.push(i < remainder ? base + 1 : base);
    }
    const valid =
      sizes.every((s) => s >= 2 && s <= 4) && sizes.reduce((a, b) => a + b, 0) === participantCount;
    if (valid) {
      return sizes;
    }
    teamCount += 1;
  }

  return [participantCount];
}

export function buildAutoTeams(
  participants: DibeParticipant[],
  shuffledIds?: string[]
): DibeTeam[] {
  const ids = shuffledIds ?? shuffle(participants.map((p) => p.id));
  const sizes = computeTeamSizes(ids.length);
  const teams: DibeTeam[] = [];
  let offset = 0;

  for (let i = 0; i < sizes.length; i++) {
    const size = sizes[i] ?? 0;
    const member_ids = ids.slice(offset, offset + size);
    offset += size;
    const rotation = shuffle([...member_ids]);
    teams.push({
      id: newId(),
      name: TEAM_NAMES[i] ?? `Team ${i + 1}`,
      color: TEAM_COLORS[i] ?? TEAM_COLORS[0],
      member_ids,
      describer_rotation: rotation,
      current_describer_index: 0,
      cumulative_score: 0,
    });
  }

  return teams;
}

function getCurrentDescriberId(team: DibeTeam): string | null {
  if (team.describer_rotation.length === 0) return null;
  const idx = team.current_describer_index % team.describer_rotation.length;
  return team.describer_rotation[idx] ?? null;
}

export function isDescriberForActiveRound(
  state: DibeState,
  participantId: string
): boolean {
  if (state.phase === "TUTORIAL_DESCRIBE") {
    return state.tutorial_describer_id === participantId;
  }
  if (state.phase === "ROUND_DESCRIBE") {
    const team = state.teams.find((t) => t.member_ids.includes(participantId));
    if (!team) return false;
    return getCurrentDescriberId(team) === participantId;
  }
  return false;
}

export function canRevealImageToEveryone(state: DibeState): boolean {
  return (
    state.phase === "TUTORIAL_IMAGE_REVEAL" || state.phase === "ROUND_IMAGE_REVEAL"
  );
}

export function canViewRoundImageReference(state: DibeState): boolean {
  if (canRevealImageToEveryone(state)) return true;
  const scoringPhases = [
    "TUTORIAL_SCORING_1PT",
    "ROUND_SCORING_1PT",
    "ROUND_SCORING_2PT",
    "ROUND_SCORING_3PT",
  ] as const;
  return scoringPhases.includes(state.phase as (typeof scoringPhases)[number]);
}

/**
 * True while the session is working through the tutorial round, including the
 * return/show-drawings phases that sit between the reveal and tutorial scoring.
 */
export function isTutorialContext(state: DibeState): boolean {
  if (state.phase.startsWith("TUTORIAL_")) return true;
  if (state.phase === "RETURN_TO_MAIN" || state.phase === "SHOW_DRAWINGS") {
    return state.post_show_drawings_phase === "TUTORIAL_SCORING_1PT";
  }
  return false;
}

export function getActiveDescriberId(
  state: DibeState,
  participantId: string
): string | null {
  const describerPhases = [
    "TUTORIAL_DESCRIBE",
    "TUTORIAL_IMAGE_REVEAL",
    "BREAKOUT_SETUP",
    "ROUND_DESCRIBE",
    "ROUND_IMAGE_REVEAL",
    "RETURN_TO_MAIN",
    "SHOW_DRAWINGS",
  ] as const;
  if (!describerPhases.includes(state.phase as (typeof describerPhases)[number])) {
    return null;
  }
  if (isTutorialContext(state)) {
    return state.tutorial_describer_id;
  }
  const team = getParticipantTeam(state, participantId);
  if (!team) return null;
  return getCurrentDescriberId(team);
}

export function getLeadDisplayName(state: DibeState): string | null {
  if (!state.lead_participant_id) return null;
  const lead = state.participants.find((p) => p.id === state.lead_participant_id);
  return lead?.display_name ?? null;
}

/** Go/countdown timestamps for the room the participant belongs to, if started. */
export function getBreakoutRoundStart(
  state: DibeState,
  participantId: string
): DibeTeamRoundStart | null {
  const team = getParticipantTeam(state, participantId);
  if (!team) return null;
  return teamRoundStarts(state)[team.id] ?? null;
}

/** Arms one room's countdown + drawing timer. Rooms already started are left alone. */
function startRoomTimer(state: DibeState, teamId: string): DibeState {
  if (state.phase !== "ROUND_DESCRIBE") return state;

  const existing = teamRoundStarts(state);
  if (existing[teamId]) return state;
  if (!state.teams.some((t) => t.id === teamId)) return state;

  const countdownStartedAt = new Date();
  const drawingStartedAt = new Date(
    countdownStartedAt.getTime() + BREAKOUT_COUNTDOWN_SECONDS * 1000
  );

  return {
    ...state,
    team_round_starts: {
      ...existing,
      [teamId]: {
        countdown_started_at: countdownStartedAt.toISOString(),
        drawing_started_at: drawingStartedAt.toISOString(),
      },
    },
  };
}

/**
 * Room-scoped round start. Only that room's current describer may fire it, and
 * only once — other breakout rooms are untouched.
 */
export function startBreakoutRound(
  state: DibeState,
  participantId: string
): DibeState {
  if (state.phase !== "ROUND_DESCRIBE") return state;

  const team = getParticipantTeam(state, participantId);
  if (!team) return state;
  if (getCurrentDescriberId(team) !== participantId) return state;

  return startRoomTimer(state, team.id);
}

/** Recovery path: lead starts a room whose describer is absent or stuck. */
export function leadStartBreakoutRound(
  state: DibeState,
  teamId: string,
  armedPhase: DibePhase
): DibeState {
  if (armedPhase !== state.phase) return state;
  return startRoomTimer(state, teamId);
}

/** Rooms still waiting on a Go press, for the lead's override list. */
export function getUnstartedTeams(state: DibeState): DibeTeam[] {
  if (state.phase !== "ROUND_DESCRIBE") return [];
  const started = teamRoundStarts(state);
  return state.teams.filter((team) => !started[team.id]);
}

export function getActiveDescriberDisplayName(
  state: DibeState,
  participantId: string
): string | null {
  const describerId = getActiveDescriberId(state, participantId);
  if (!describerId) return null;
  const participant = state.participants.find((p) => p.id === describerId);
  return participant?.display_name ?? null;
}

function pickRoundImage(
  catalog: DibeImageCatalogEntry[],
  used: string[],
  roundNumber: number
): DibeImageCatalogEntry {
  const pool = catalog.filter(
    (img) =>
      img.name !== TUTORIAL_IMAGE_NAME &&
      !used.includes(img.id) &&
      (SCORED_ROUND_IMAGE_NAMES as readonly string[]).includes(img.name)
  );
  if (pool.length > 0) {
    return pickRandom(pool);
  }
  const recycled = catalog.filter(
    (img) =>
      img.name !== TUTORIAL_IMAGE_NAME &&
      (SCORED_ROUND_IMAGE_NAMES as readonly string[]).includes(img.name)
  );
  if (recycled.length === 0) {
    throw new Error("No scored round images in catalog.");
  }
  return recycled[(roundNumber - 1) % recycled.length] as DibeImageCatalogEntry;
}

function activeImageCriteria(state: DibeState): DibeCriterion[] {
  const entry = state.image_catalog.find((i) => i.id === state.active_image_id);
  return entry ? sortCriteria(entry.criteria) : [];
}

function allParticipantsSubmitted(
  state: DibeState,
  criteria: DibeCriterion[]
): boolean {
  const keys = criteria.map((c) => c.text);
  const describerIds = new Set<string>();

  if (state.phase === "TUTORIAL_SCORING_1PT") {
    if (state.tutorial_describer_id) {
      describerIds.add(state.tutorial_describer_id);
    }
  } else if (
    state.phase === "ROUND_SCORING_1PT" ||
    state.phase === "ROUND_SCORING_2PT" ||
    state.phase === "ROUND_SCORING_3PT"
  ) {
    for (const team of state.teams) {
      const describerId = getCurrentDescriberId(team);
      if (describerId) {
        describerIds.add(describerId);
      }
    }
  }

  return state.participants.every((p) => {
    if (describerIds.has(p.id)) {
      return true;
    }
    const sub = state.scoring_submissions[p.id];
    if (!sub) return false;
    return keys.every((k) => typeof sub[k] === "boolean");
  });
}

function scoreSubmission(
  criteria: DibeCriterion[],
  answers: Record<string, boolean>
): number {
  let total = 0;
  for (const c of criteria) {
    if (answers[c.text] === true) {
      total += c.points;
    }
  }
  return total;
}

function mergeCriterionHits(
  existing: Record<string, number>,
  criteria: DibeCriterion[],
  submissions: Record<string, Record<string, boolean>>
): Record<string, number> {
  const hits = { ...existing };
  for (const c of criteria) {
    let count = hits[c.text] ?? 0;
    for (const p of Object.keys(submissions)) {
      if (submissions[p]?.[c.text] === true) {
        count += 1;
      }
    }
    hits[c.text] = count;
  }
  return hits;
}

function computeTeamRoundScores(
  teams: DibeTeam[],
  participantScores: Record<string, number>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const team of teams) {
    out[team.id] = team.member_ids.reduce(
      (sum, id) => sum + (participantScores[id] ?? 0),
      0
    );
  }
  return out;
}

function advanceDescriberIndices(teams: DibeTeam[]): DibeTeam[] {
  return teams.map((t) => ({
    ...t,
    current_describer_index: t.current_describer_index + 1,
  }));
}

export function initializeGame(
  participants: DibeParticipant[],
  imageCatalog: DibeImageCatalogEntry[],
  leadParticipantId: string | null = null
): DibeState {
  if (participants.length < 3 || participants.length > 20) {
    throw new Error("Player count must be between 3 and 20.");
  }
  if (imageCatalog.length === 0) {
    throw new Error("Image catalog is required.");
  }

  const ids = participants.map((p) => p.id);

  return {
    version: DIBE_PROTOCOL_VERSION,
    phase: "MATERIALS_CHECK",
    participants,
    session_length: null,
    total_rounds_played: 0,
    current_round: 0,
    progress_total_rounds: 5,
    teams: [],
    team_formation_mode: null,
    teams_locked: false,
    lead_participant_id: leadParticipantId,
    team_round_starts: {},
    post_show_drawings_phase: null,
    image_catalog: imageCatalog,
    tutorial_describer_id: null,
    active_image_id: null,
    active_image_name: null,
    active_criteria: [],
    images_used: [],
    rounds: [],
    scoring_submissions: {},
    round_criterion_hits: {},
    participant_cumulative_scores: emptyScores(ids),
    describer_best_round_scores: emptyScores(ids),
    timer_started_at: null,
    last_expired_timer_at: null,
    timer_duration_seconds: 0,
    session_complete: false,
    formation_error: null,
  };
}

export function setSessionLength(
  state: DibeState,
  sessionLength: DibeSessionLength
): DibeState {
  if (state.phase !== "MATERIALS_CHECK") return state;
  return {
    ...state,
    session_length: sessionLength,
    progress_total_rounds: scoredRoundCount(sessionLength),
  };
}

export function readyMaterials(state: DibeState): DibeState {
  if (state.phase !== "MATERIALS_CHECK") return state;
  if (!state.session_length) {
    throw new Error("Lead must select session length before continuing.");
  }
  const robo = findRoboDoc(state.image_catalog);
  const describer = pickRandom(state.participants);
  return withTimer(
    {
      ...state,
      phase: "TUTORIAL_DESCRIBE",
      tutorial_describer_id: describer.id,
      active_image_id: robo.id,
      active_image_name: robo.name,
      active_criteria: [],
    },
    90
  );
}

/**
 * Session-wide ROUND_DESCRIBE exit. Reached when the last room finishes, or
 * when the lead force-ends drawing.
 */
function advanceFromRoundDescribe(state: DibeState): DibeState {
  if (state.phase !== "ROUND_DESCRIBE") return state;
  return {
    ...state,
    phase: "ROUND_IMAGE_REVEAL",
    timer_started_at: null,
    timer_duration_seconds: 0,
  };
}

/**
 * Rooms still drawing: those that started and have not been marked complete.
 * A room that never pressed Go has no team_round_starts entry at all and is
 * therefore never pending — otherwise it would block the session forever.
 */
export function getPendingDrawingTeamIds(state: DibeState): string[] {
  if (state.phase !== "ROUND_DESCRIBE") return [];
  return Object.entries(teamRoundStarts(state))
    .filter(([, start]) => start.drawing_started_at && !start.drawing_completed_at)
    .map(([teamId]) => teamId);
}

/** True once this participant's room has finished drawing. */
export function isRoomDrawingComplete(
  state: DibeState,
  participantId: string
): boolean {
  return Boolean(getBreakoutRoundStart(state, participantId)?.drawing_completed_at);
}

/**
 * Marks the poster's room done. Idempotent per room, so every client in that
 * room can post its own expiry harmlessly. Only the room whose completion
 * empties the pending set advances the session.
 */
function markRoomDrawingComplete(
  state: DibeState,
  participantId: string | null
): DibeState {
  if (!participantId) return state;

  const team = getParticipantTeam(state, participantId);
  if (!team) return state;

  const starts = teamRoundStarts(state);
  const roomStart = starts[team.id];
  if (!roomStart?.drawing_started_at) return state;
  if (roomStart.drawing_completed_at) return state;

  const next: DibeState = {
    ...state,
    team_round_starts: {
      ...starts,
      [team.id]: {
        ...roomStart,
        drawing_completed_at: new Date().toISOString(),
      },
    },
  };

  return getPendingDrawingTeamIds(next).length === 0
    ? advanceFromRoundDescribe(next)
    : next;
}

export function onDescribeTimerExpired(
  state: DibeState,
  armedPhase: DibePhase,
  participantId: string | null = null
): DibeState {
  if (armedPhase !== state.phase) return state;
  if (state.phase === "TUTORIAL_DESCRIBE") {
    // No breakout rooms in the tutorial — one shared timer, one advance.
    return {
      ...state,
      phase: "TUTORIAL_IMAGE_REVEAL",
      timer_started_at: null,
      timer_duration_seconds: 0,
    };
  }
  if (state.phase === "ROUND_DESCRIBE") {
    return markRoomDrawingComplete(state, participantId);
  }
  return state;
}

/**
 * Lead recovery for a room that pressed Go and then stalled. This is the old
 * session-wide behaviour, now behind deliberate lead intent rather than
 * whichever room happened to finish first.
 */
export function leadEndDrawingForAllRooms(
  state: DibeState,
  armedPhase: DibePhase
): DibeState {
  if (armedPhase !== state.phase) return state;
  if (state.phase !== "ROUND_DESCRIBE") return state;
  return advanceFromRoundDescribe(state);
}

export function advanceFromImageReveal(
  state: DibeState,
  armedPhase: DibePhase
): DibeState {
  if (armedPhase !== state.phase) return state;
  if (state.phase !== "TUTORIAL_IMAGE_REVEAL" && state.phase !== "ROUND_IMAGE_REVEAL") {
    return state;
  }
  return {
    ...state,
    phase: "RETURN_TO_MAIN",
    post_show_drawings_phase:
      state.phase === "TUTORIAL_IMAGE_REVEAL"
        ? "TUTORIAL_SCORING_1PT"
        : "ROUND_SCORING_1PT",
    timer_started_at: null,
    last_expired_timer_at: null,
    timer_duration_seconds: 0,
  };
}

/** Lead-only: everyone is back in the main room, start the show-and-tell timer. */
export function everyoneBack(state: DibeState): DibeState {
  if (state.phase !== "RETURN_TO_MAIN") return state;
  return withTimer({ ...state, phase: "SHOW_DRAWINGS" }, SHOW_DRAWINGS_SECONDS);
}

export function onShowDrawingsTimerExpired(
  state: DibeState,
  armedPhase: DibePhase
): DibeState {
  if (armedPhase !== state.phase) return state;
  if (state.phase !== "SHOW_DRAWINGS") return state;
  if (
    !state.timer_started_at ||
    state.timer_started_at === state.last_expired_timer_at
  ) {
    return state;
  }
  return enterScoringFromDrawings({
    ...state,
    last_expired_timer_at: state.timer_started_at,
  });
}

/** Lead-only: consumes the same timer window so a racing expiry post no-ops. */
export function skipShowDrawings(state: DibeState): DibeState {
  if (state.phase !== "SHOW_DRAWINGS") return state;
  if (state.timer_started_at === state.last_expired_timer_at) return state;
  return enterScoringFromDrawings({
    ...state,
    last_expired_timer_at: state.timer_started_at,
  });
}

function enterScoringFromDrawings(state: DibeState): DibeState {
  const criteria = criteriaForPoints(activeImageCriteria(state), 1);

  if (state.post_show_drawings_phase === "TUTORIAL_SCORING_1PT") {
    return withTimer(
      {
        ...state,
        phase: "TUTORIAL_SCORING_1PT",
        post_show_drawings_phase: null,
        active_criteria: criteria,
        scoring_submissions: {},
      },
      40,
      true
    );
  }

  return withTimer(
    {
      ...state,
      phase: "ROUND_SCORING_1PT",
      post_show_drawings_phase: null,
      active_criteria: criteria,
      scoring_submissions: {},
      round_criterion_hits: {},
    },
    35,
    true
  );
}

export function submitScoring(
  state: DibeState,
  participantId: string,
  answers: Record<string, boolean>
): DibeState {
  const scoringPhases = [
    "TUTORIAL_SCORING_1PT",
    "ROUND_SCORING_1PT",
    "ROUND_SCORING_2PT",
    "ROUND_SCORING_3PT",
  ] as const;
  if (!scoringPhases.includes(state.phase as (typeof scoringPhases)[number])) {
    return state;
  }

  const criteria = state.active_criteria;
  const filtered: Record<string, boolean> = {};
  for (const c of criteria) {
    if (typeof answers[c.text] === "boolean") {
      filtered[c.text] = answers[c.text];
    }
  }

  const scoring_submissions = {
    ...state.scoring_submissions,
    [participantId]: { ...state.scoring_submissions[participantId], ...filtered },
  };

  let next: DibeState = { ...state, scoring_submissions };
  if (allParticipantsSubmitted(next, criteria)) {
    next = advanceScoringPhase(next);
  }
  return next;
}

export function onScoringTimerExpired(
  state: DibeState,
  armedPhase: DibePhase
): DibeState {
  // The armed phase pins the post to one specific tier; the category check
  // below alone would let a 1PT post consume the 2PT window.
  if (armedPhase !== state.phase) return state;
  const scoringPhases = [
    "TUTORIAL_SCORING_1PT",
    "ROUND_SCORING_1PT",
    "ROUND_SCORING_2PT",
    "ROUND_SCORING_3PT",
  ];
  if (!scoringPhases.includes(state.phase)) return state;
  if (
    !state.timer_started_at ||
    state.timer_started_at === state.last_expired_timer_at
  ) {
    return state;
  }
  return advanceScoringPhase({
    ...state,
    last_expired_timer_at: state.timer_started_at,
  });
}

function advanceScoringPhase(state: DibeState): DibeState {
  const allCriteria = activeImageCriteria(state);

  if (state.phase === "TUTORIAL_SCORING_1PT") {
    const criteria = criteriaForPoints(allCriteria, 1);
    const hits = mergeCriterionHits(
      {},
      criteria,
      state.scoring_submissions
    );
    return {
      ...state,
      phase: "TUTORIAL_RESULTS",
      round_criterion_hits: hits,
      timer_started_at: null,
      timer_duration_seconds: 0,
      active_criteria: criteria,
      scoring_submissions: {},
    };
  }

  if (state.phase === "ROUND_SCORING_1PT") {
    const criteria = criteriaForPoints(allCriteria, 1);
    const hits = mergeCriterionHits(
      state.round_criterion_hits,
      criteria,
      state.scoring_submissions
    );
    const nextCriteria = criteriaForPoints(allCriteria, 2);
    return withTimer(
      {
        ...state,
        phase: "ROUND_SCORING_2PT",
        round_criterion_hits: hits,
        active_criteria: nextCriteria,
        scoring_submissions: {},
      },
      35
    );
  }

  if (state.phase === "ROUND_SCORING_2PT") {
    const criteria = criteriaForPoints(allCriteria, 2);
    const hits = mergeCriterionHits(
      state.round_criterion_hits,
      criteria,
      state.scoring_submissions
    );
    const nextCriteria = criteriaForPoints(allCriteria, 3);
    return withTimer(
      {
        ...state,
        phase: "ROUND_SCORING_3PT",
        round_criterion_hits: hits,
        active_criteria: nextCriteria,
        scoring_submissions: {},
      },
      35
    );
  }

  if (state.phase === "ROUND_SCORING_3PT") {
    const criteria = criteriaForPoints(allCriteria, 3);
    const hits = mergeCriterionHits(
      state.round_criterion_hits,
      criteria,
      state.scoring_submissions
    );
    return finalizeRoundScoring({
      ...state,
      round_criterion_hits: hits,
      scoring_submissions: state.scoring_submissions,
    });
  }

  return state;
}

function finalizeRoundScoring(state: DibeState): DibeState {
  const allCriteria = activeImageCriteria(state);
  const participant_round_scores: Record<string, number> = {};
  for (const p of state.participants) {
    const answers = state.scoring_submissions[p.id] ?? {};
    participant_round_scores[p.id] = scoreSubmission(allCriteria, answers);
  }

  const team_round_scores = computeTeamRoundScores(state.teams, participant_round_scores);
  const teams = state.teams.map((t) => ({
    ...t,
    cumulative_score: t.cumulative_score + (team_round_scores[t.id] ?? 0),
  }));

  const participant_cumulative_scores = { ...state.participant_cumulative_scores };
  for (const p of state.participants) {
    participant_cumulative_scores[p.id] =
      (participant_cumulative_scores[p.id] ?? 0) +
      (participant_round_scores[p.id] ?? 0);
  }

  const describer_best_round_scores = { ...state.describer_best_round_scores };
  for (const team of teams) {
    const describerId = getCurrentDescriberId(team);
    if (!describerId) continue;
    const roundScore = team_round_scores[team.id] ?? 0;
    const prev = describer_best_round_scores[describerId] ?? 0;
    if (roundScore > prev) {
      describer_best_round_scores[describerId] = roundScore;
    }
  }

  const round: DibeState["rounds"][0] = {
    round_number: state.current_round,
    image_id: state.active_image_id ?? "",
    image_name: state.active_image_name ?? "",
    criterion_hits: { ...state.round_criterion_hits },
    participant_round_scores,
    team_round_scores,
  };

  const total_rounds_played = state.total_rounds_played + 1;
  const sessionLength = state.session_length ?? "SHORT";

  let next: DibeState = {
    ...state,
    teams,
    rounds: [...state.rounds, round],
    total_rounds_played,
    participant_cumulative_scores,
    describer_best_round_scores,
    phase: "ROUND_AGGREGATE",
    timer_started_at: null,
    timer_duration_seconds: 0,
    active_criteria: allCriteria,
    scoring_submissions: {},
  };

  return next;
}

export function startTeamFormation(state: DibeState): DibeState {
  if (state.phase !== "TUTORIAL_RESULTS") return state;
  return {
    ...state,
    phase: "TEAM_FORMATION",
    team_formation_mode: null,
    teams_locked: false,
    teams: [],
    formation_error: null,
  };
}

export function autoAssignTeams(state: DibeState): DibeState {
  if (state.phase !== "TEAM_FORMATION") return state;
  try {
    const teams = buildAutoTeams(state.participants);
    return {
      ...state,
      team_formation_mode: "auto",
      teams,
      formation_error: null,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not form teams.";
    return { ...state, formation_error: message };
  }
}

export function enableSelfSelectTeams(state: DibeState): DibeState {
  if (state.phase !== "TEAM_FORMATION") return state;
  const teamCount = computeTeamSizes(state.participants.length).length;
  const teams: DibeTeam[] = [];
  for (let i = 0; i < teamCount; i++) {
    teams.push({
      id: newId(),
      name: TEAM_NAMES[i] ?? `Team ${i + 1}`,
      color: TEAM_COLORS[i] ?? TEAM_COLORS[0],
      member_ids: [],
      describer_rotation: [],
      current_describer_index: 0,
      cumulative_score: 0,
    });
  }
  return {
    ...state,
    team_formation_mode: "self_select",
    teams,
    formation_error: null,
  };
}

export function joinTeam(
  state: DibeState,
  participantId: string,
  teamId: string
): DibeState {
  if (state.phase !== "TEAM_FORMATION" || state.team_formation_mode !== "self_select") {
    return state;
  }
  if (state.teams_locked) return state;

  const teams = state.teams.map((t) => ({
    ...t,
    member_ids: t.member_ids.filter((id) => id !== participantId),
  }));

  const idx = teams.findIndex((t) => t.id === teamId);
  if (idx < 0) return state;

  const target = teams[idx];
  if (target.member_ids.length >= 4) return state;

  teams[idx] = {
    ...target,
    member_ids: [...target.member_ids, participantId],
  };

  return { ...state, teams };
}

export function lockTeams(state: DibeState): DibeState {
  if (state.phase !== "TEAM_FORMATION") return state;

  const allAssigned = state.participants.every((p) =>
    state.teams.some((t) => t.member_ids.includes(p.id))
  );
  if (!allAssigned) {
    return { ...state, formation_error: "Every participant must join a team." };
  }

  const singleton = state.teams.some((t) => t.member_ids.length < 2);
  if (singleton && state.teams.length > 1) {
    return {
      ...state,
      formation_error: "Each team needs at least 2 members.",
    };
  }

  const teams = state.teams.map((t) => {
    const rotation = shuffle([...t.member_ids]);
    return {
      ...t,
      describer_rotation: rotation,
      current_describer_index: 0,
    };
  });

  return {
    ...state,
    teams,
    teams_locked: true,
    formation_error: null,
    phase: "BREAKOUT_SETUP",
  };
}

export function startRound(state: DibeState): DibeState {
  if (state.phase !== "BREAKOUT_SETUP") return state;
  const sessionLength = state.session_length ?? "SHORT";
  const nextRound = state.current_round + 1;
  const maxRounds = scoredRoundCount(sessionLength);
  if (nextRound > maxRounds) {
    return { ...state, phase: "FINAL_RESULTS", session_complete: true };
  }

  const image = pickRoundImage(state.image_catalog, state.images_used, nextRound);

  // Each breakout room starts its own drawing timer once its describer hits Go.
  return {
    ...state,
    phase: "ROUND_DESCRIBE",
    current_round: nextRound,
    active_image_id: image.id,
    active_image_name: image.name,
    active_criteria: [],
    images_used: [...state.images_used, image.id],
    round_criterion_hits: {},
    scoring_submissions: {},
    team_round_starts: {},
    timer_started_at: null,
    last_expired_timer_at: null,
    timer_duration_seconds: ROUND_DRAWING_SECONDS,
  };
}

export function advanceFromAggregate(state: DibeState): DibeState {
  if (state.phase !== "ROUND_AGGREGATE") return state;
  const sessionLength = state.session_length ?? "SHORT";
  if (shouldShowLeaderboard(sessionLength, state.total_rounds_played)) {
    return { ...state, phase: "LEADERBOARD" };
  }
  return continueAfterRound(state);
}

export function dismissLeaderboard(state: DibeState): DibeState {
  if (state.phase !== "LEADERBOARD") return state;
  return continueAfterRound(state);
}

function continueAfterRound(state: DibeState): DibeState {
  const sessionLength = state.session_length ?? "SHORT";
  const maxRounds = scoredRoundCount(sessionLength);

  if (state.total_rounds_played >= maxRounds) {
    return { ...state, phase: "FINAL_RESULTS", session_complete: true };
  }

  const teams = advanceDescriberIndices(state.teams);
  return {
    ...state,
    teams,
    phase: "BREAKOUT_SETUP",
  };
}

export function endSession(state: DibeState): DibeState {
  return { ...state, session_complete: true, phase: "FINAL_RESULTS" };
}

/**
 * Phases that advance on a timer. Each one exposes a lead-only manual advance
 * so a stalled or absent participant cannot deadlock the session.
 */
export const DIBE_TIMED_PHASES = [
  "TUTORIAL_DESCRIBE",
  "ROUND_DESCRIBE",
  "TUTORIAL_IMAGE_REVEAL",
  "ROUND_IMAGE_REVEAL",
  "SHOW_DRAWINGS",
  "TUTORIAL_SCORING_1PT",
  "ROUND_SCORING_1PT",
  "ROUND_SCORING_2PT",
  "ROUND_SCORING_3PT",
] as const;

export function isTimedPhase(phase: DibePhase): boolean {
  return DIBE_TIMED_PHASES.includes(phase as (typeof DIBE_TIMED_PHASES)[number]);
}

/**
 * Lead override for a timed phase: performs exactly the transition the timer
 * expiry would have performed, reusing the same handlers and guards.
 */
export function leadAdvanceTimedPhase(
  state: DibeState,
  armedPhase: DibePhase
): DibeState {
  if (armedPhase !== state.phase) return state;

  switch (state.phase) {
    // ROUND_DESCRIBE is deliberately absent: it ends per-room, so a blanket
    // advance is never the timer's job there. The lead's paths on that phase
    // are leadStartBreakoutRound and leadEndDrawingForAllRooms.
    case "TUTORIAL_DESCRIBE":
      return onDescribeTimerExpired(state, armedPhase);
    case "TUTORIAL_IMAGE_REVEAL":
    case "ROUND_IMAGE_REVEAL":
      return advanceFromImageReveal(state, armedPhase);
    case "SHOW_DRAWINGS":
      return onShowDrawingsTimerExpired(state, armedPhase);
    case "TUTORIAL_SCORING_1PT":
    case "ROUND_SCORING_1PT":
    case "ROUND_SCORING_2PT":
    case "ROUND_SCORING_3PT":
      return onScoringTimerExpired(state, armedPhase);
    default:
      return state;
  }
}

export type DibeEngineAction =
  | {
      type: "initializeGame";
      participants: DibeParticipant[];
      imageCatalog: DibeImageCatalogEntry[];
      leadParticipantId: string | null;
    }
  | { type: "setSessionLength"; sessionLength: DibeSessionLength }
  | { type: "readyMaterials" }
  | { type: "startBreakoutRound"; participantId: string }
  // Lead-only recovery paths. Both carry armedPhase for the same guard expiries use.
  | { type: "leadStartBreakoutRound"; teamId: string; armedPhase: DibePhase }
  | { type: "leadAdvanceTimedPhase"; armedPhase: DibePhase }
  | { type: "leadEndDrawingForAllRooms"; armedPhase: DibePhase }
  // Expiry actions carry the phase their timer was armed under so a post that
  // arrives after the session moved on is discarded instead of consuming a window.
  // participantId resolves which breakout room finished; ROUND_DESCRIBE ends
  // per-room, so a poster with no room simply marks nothing.
  | {
      type: "describeTimerExpired";
      armedPhase: DibePhase;
      participantId: string | null;
    }
  | { type: "advanceFromImageReveal"; armedPhase: DibePhase }
  | { type: "everyoneBack" }
  | { type: "showDrawingsTimerExpired"; armedPhase: DibePhase }
  | { type: "skipShowDrawings" }
  | { type: "submitScoring"; participantId: string; answers: Record<string, boolean> }
  | { type: "scoringTimerExpired"; armedPhase: DibePhase }
  | { type: "startTeamFormation" }
  | { type: "autoAssignTeams" }
  | { type: "enableSelfSelectTeams" }
  | { type: "joinTeam"; participantId: string; teamId: string }
  | { type: "lockTeams" }
  | { type: "startRound" }
  | { type: "advanceFromAggregate" }
  | { type: "dismissLeaderboard" }
  | { type: "endSession" };

export function reduceDrawItByEarState(
  state: DibeState | null,
  action: DibeEngineAction
): DibeState {
  switch (action.type) {
    case "initializeGame":
      return initializeGame(
        action.participants,
        action.imageCatalog,
        action.leadParticipantId
      );
    case "setSessionLength":
      if (!state) throw new Error("Draw It By Ear state not initialized");
      return setSessionLength(state, action.sessionLength);
    case "readyMaterials":
      if (!state) throw new Error("Draw It By Ear state not initialized");
      return readyMaterials(state);
    case "startBreakoutRound":
      if (!state) throw new Error("Draw It By Ear state not initialized");
      return startBreakoutRound(state, action.participantId);
    case "leadStartBreakoutRound":
      if (!state) throw new Error("Draw It By Ear state not initialized");
      return leadStartBreakoutRound(state, action.teamId, action.armedPhase);
    case "leadAdvanceTimedPhase":
      if (!state) throw new Error("Draw It By Ear state not initialized");
      return leadAdvanceTimedPhase(state, action.armedPhase);
    case "leadEndDrawingForAllRooms":
      if (!state) throw new Error("Draw It By Ear state not initialized");
      return leadEndDrawingForAllRooms(state, action.armedPhase);
    case "describeTimerExpired":
      if (!state) throw new Error("Draw It By Ear state not initialized");
      return onDescribeTimerExpired(
        state,
        action.armedPhase,
        action.participantId
      );
    case "advanceFromImageReveal":
      if (!state) throw new Error("Draw It By Ear state not initialized");
      return advanceFromImageReveal(state, action.armedPhase);
    case "everyoneBack":
      if (!state) throw new Error("Draw It By Ear state not initialized");
      return everyoneBack(state);
    case "showDrawingsTimerExpired":
      if (!state) throw new Error("Draw It By Ear state not initialized");
      return onShowDrawingsTimerExpired(state, action.armedPhase);
    case "skipShowDrawings":
      if (!state) throw new Error("Draw It By Ear state not initialized");
      return skipShowDrawings(state);
    case "submitScoring":
      if (!state) throw new Error("Draw It By Ear state not initialized");
      return submitScoring(state, action.participantId, action.answers);
    case "scoringTimerExpired":
      if (!state) throw new Error("Draw It By Ear state not initialized");
      return onScoringTimerExpired(state, action.armedPhase);
    case "startTeamFormation":
      if (!state) throw new Error("Draw It By Ear state not initialized");
      return startTeamFormation(state);
    case "autoAssignTeams":
      if (!state) throw new Error("Draw It By Ear state not initialized");
      return autoAssignTeams(state);
    case "enableSelfSelectTeams":
      if (!state) throw new Error("Draw It By Ear state not initialized");
      return enableSelfSelectTeams(state);
    case "joinTeam":
      if (!state) throw new Error("Draw It By Ear state not initialized");
      return joinTeam(state, action.participantId, action.teamId);
    case "lockTeams":
      if (!state) throw new Error("Draw It By Ear state not initialized");
      return lockTeams(state);
    case "startRound":
      if (!state) throw new Error("Draw It By Ear state not initialized");
      return startRound(state);
    case "advanceFromAggregate":
      if (!state) throw new Error("Draw It By Ear state not initialized");
      return advanceFromAggregate(state);
    case "dismissLeaderboard":
      if (!state) throw new Error("Draw It By Ear state not initialized");
      return dismissLeaderboard(state);
    case "endSession":
      if (!state) throw new Error("Draw It By Ear state not initialized");
      return endSession(state);
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

/** Expiry posts must name the phase the timer was armed under. */
function requireArmedPhase(
  actionType: string,
  payload: Record<string, unknown>
): DibePhase {
  const armedPhase = payload.armedPhase;
  if (typeof armedPhase !== "string") {
    throw new Error(`${actionType} requires armedPhase`);
  }
  return armedPhase as DibePhase;
}

export function clientPayloadToEngineAction(
  actionType: string,
  payload: Record<string, unknown>
): DibeEngineAction {
  switch (actionType) {
    case "initializeGame": {
      const participants = payload.participants;
      const imageCatalog = payload.imageCatalog;
      if (!Array.isArray(participants) || !Array.isArray(imageCatalog)) {
        throw new Error("initializeGame requires participants and imageCatalog arrays");
      }
      const leadParticipantId = payload.leadParticipantId;
      return {
        type: "initializeGame",
        participants: participants as DibeParticipant[],
        imageCatalog: imageCatalog as DibeImageCatalogEntry[],
        leadParticipantId:
          typeof leadParticipantId === "string" ? leadParticipantId : null,
      };
    }
    case "setSessionLength": {
      const sessionLength = payload.sessionLength;
      if (sessionLength !== "FULL" && sessionLength !== "SHORT") {
        throw new Error("setSessionLength requires FULL or SHORT");
      }
      return { type: "setSessionLength", sessionLength };
    }
    case "readyMaterials":
      return { type: "readyMaterials" };
    case "startBreakoutRound": {
      const participantId = payload.participantId;
      if (typeof participantId !== "string") {
        throw new Error("startBreakoutRound requires participantId");
      }
      return { type: "startBreakoutRound", participantId };
    }
    case "leadStartBreakoutRound": {
      const teamId = payload.teamId;
      if (typeof teamId !== "string") {
        throw new Error("leadStartBreakoutRound requires teamId");
      }
      return {
        type: "leadStartBreakoutRound",
        teamId,
        armedPhase: requireArmedPhase(actionType, payload),
      };
    }
    case "leadAdvanceTimedPhase":
      return {
        type: "leadAdvanceTimedPhase",
        armedPhase: requireArmedPhase(actionType, payload),
      };
    case "leadEndDrawingForAllRooms":
      return {
        type: "leadEndDrawingForAllRooms",
        armedPhase: requireArmedPhase(actionType, payload),
      };
    case "describeTimerExpired":
      return {
        type: "describeTimerExpired",
        armedPhase: requireArmedPhase(actionType, payload),
        participantId:
          typeof payload.participantId === "string" ? payload.participantId : null,
      };
    case "advanceFromImageReveal":
      return {
        type: "advanceFromImageReveal",
        armedPhase: requireArmedPhase(actionType, payload),
      };
    case "everyoneBack":
      return { type: "everyoneBack" };
    case "showDrawingsTimerExpired":
      return {
        type: "showDrawingsTimerExpired",
        armedPhase: requireArmedPhase(actionType, payload),
      };
    case "skipShowDrawings":
      return { type: "skipShowDrawings" };
    case "submitScoring": {
      const participantId = payload.participantId;
      const answers = payload.answers;
      if (typeof participantId !== "string" || typeof answers !== "object" || answers === null) {
        throw new Error("submitScoring requires participantId and answers");
      }
      return {
        type: "submitScoring",
        participantId,
        answers: answers as Record<string, boolean>,
      };
    }
    case "scoringTimerExpired":
      return {
        type: "scoringTimerExpired",
        armedPhase: requireArmedPhase(actionType, payload),
      };
    case "startTeamFormation":
      return { type: "startTeamFormation" };
    case "autoAssignTeams":
      return { type: "autoAssignTeams" };
    case "enableSelfSelectTeams":
      return { type: "enableSelfSelectTeams" };
    case "joinTeam": {
      const participantId = payload.participantId;
      const teamId = payload.teamId;
      if (typeof participantId !== "string" || typeof teamId !== "string") {
        throw new Error("joinTeam requires participantId and teamId");
      }
      return { type: "joinTeam", participantId, teamId };
    }
    case "lockTeams":
      return { type: "lockTeams" };
    case "startRound":
      return { type: "startRound" };
    case "advanceFromAggregate":
      return { type: "advanceFromAggregate" };
    case "dismissLeaderboard":
      return { type: "dismissLeaderboard" };
    case "endSession":
      return { type: "endSession" };
    default:
      throw new Error(`Unknown actionType: ${actionType}`);
  }
}

export function getParticipantTeam(
  state: DibeState,
  participantId: string
): DibeTeam | undefined {
  return state.teams.find((t) => t.member_ids.includes(participantId));
}

export function getMvpDescriberId(state: DibeState): string | null {
  let bestId: string | null = null;
  let best = -1;
  for (const [id, score] of Object.entries(state.describer_best_round_scores)) {
    if (score > best) {
      best = score;
      bestId = id;
    }
  }
  return bestId;
}

export function getMostPreciseDrawerId(state: DibeState): string | null {
  let bestId: string | null = null;
  let best = -1;
  for (const [id, score] of Object.entries(state.participant_cumulative_scores)) {
    if (score > best) {
      best = score;
      bestId = id;
    }
  }
  return bestId;
}
