/**
 * Pure state transitions for Draw It By Ear — no React; safe to run on the server.
 */

import type {
  DibeCriterion,
  DibeImageCatalogEntry,
  DibeParticipant,
  DibeSessionLength,
  DibeState,
  DibeTeam,
} from "./types";
import { DIBE_PROTOCOL_VERSION } from "./types";

const TUTORIAL_IMAGE_NAME = "RoboDoc";

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
  if (participantCount < 5) {
    throw new Error("Draw It By Ear needs at least 5 players.");
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
  return state.participants.every((p) => {
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
  imageCatalog: DibeImageCatalogEntry[]
): DibeState {
  if (participants.length < 5 || participants.length > 20) {
    throw new Error("Player count must be between 5 and 20.");
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

export function onDescribeTimerExpired(state: DibeState): DibeState {
  if (state.phase === "TUTORIAL_DESCRIBE") {
    return {
      ...state,
      phase: "TUTORIAL_IMAGE_REVEAL",
      timer_started_at: null,
      timer_duration_seconds: 0,
    };
  }
  if (state.phase === "ROUND_DESCRIBE") {
    return {
      ...state,
      phase: "ROUND_IMAGE_REVEAL",
      timer_started_at: null,
      timer_duration_seconds: 0,
    };
  }
  return state;
}

export function advanceFromImageReveal(state: DibeState): DibeState {
  if (state.phase !== "TUTORIAL_IMAGE_REVEAL" && state.phase !== "ROUND_IMAGE_REVEAL") {
    return state;
  }
  if (state.phase === "TUTORIAL_IMAGE_REVEAL") {
    const criteria = criteriaForPoints(activeImageCriteria(state), 1);
    return withTimer(
      {
        ...state,
        phase: "TUTORIAL_SCORING_1PT",
        active_criteria: criteria,
        scoring_submissions: {},
      },
      40,
      true
    );
  }
  if (state.phase === "ROUND_IMAGE_REVEAL") {
    const criteria = criteriaForPoints(activeImageCriteria(state), 1);
    return withTimer(
      {
        ...state,
        phase: "ROUND_SCORING_1PT",
        active_criteria: criteria,
        scoring_submissions: {},
        round_criterion_hits: {},
      },
      40,
      true
    );
  }
  return state;
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

export function onScoringTimerExpired(state: DibeState): DibeState {
  const scoringPhases = [
    "TUTORIAL_SCORING_1PT",
    "ROUND_SCORING_1PT",
    "ROUND_SCORING_2PT",
    "ROUND_SCORING_3PT",
  ];
  if (!scoringPhases.includes(state.phase)) return state;
  return advanceScoringPhase(state);
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
        scoring_submissions: state.scoring_submissions,
      },
      25
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
        scoring_submissions: state.scoring_submissions,
      },
      20
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

  return withTimer(
    {
      ...state,
      phase: "ROUND_DESCRIBE",
      current_round: nextRound,
      active_image_id: image.id,
      active_image_name: image.name,
      active_criteria: [],
      images_used: [...state.images_used, image.id],
      round_criterion_hits: {},
      scoring_submissions: {},
    },
    90
  );
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

export type DibeEngineAction =
  | { type: "initializeGame"; participants: DibeParticipant[]; imageCatalog: DibeImageCatalogEntry[] }
  | { type: "setSessionLength"; sessionLength: DibeSessionLength }
  | { type: "readyMaterials" }
  | { type: "describeTimerExpired" }
  | { type: "advanceFromImageReveal" }
  | { type: "submitScoring"; participantId: string; answers: Record<string, boolean> }
  | { type: "scoringTimerExpired" }
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
      return initializeGame(action.participants, action.imageCatalog);
    case "setSessionLength":
      if (!state) throw new Error("Draw It By Ear state not initialized");
      return setSessionLength(state, action.sessionLength);
    case "readyMaterials":
      if (!state) throw new Error("Draw It By Ear state not initialized");
      return readyMaterials(state);
    case "describeTimerExpired":
      if (!state) throw new Error("Draw It By Ear state not initialized");
      return onDescribeTimerExpired(state);
    case "advanceFromImageReveal":
      if (!state) throw new Error("Draw It By Ear state not initialized");
      return advanceFromImageReveal(state);
    case "submitScoring":
      if (!state) throw new Error("Draw It By Ear state not initialized");
      return submitScoring(state, action.participantId, action.answers);
    case "scoringTimerExpired":
      if (!state) throw new Error("Draw It By Ear state not initialized");
      return onScoringTimerExpired(state);
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
      return {
        type: "initializeGame",
        participants: participants as DibeParticipant[],
        imageCatalog: imageCatalog as DibeImageCatalogEntry[],
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
    case "describeTimerExpired":
      return { type: "describeTimerExpired" };
    case "advanceFromImageReveal":
      return { type: "advanceFromImageReveal" };
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
      return { type: "scoringTimerExpired" };
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
