/**
 * Pure Say Less helpers — categories, teams, deck, preview, pile, pace.
 * No I/O. Safe for unit tests.
 */

export const SAY_LESS_MIN_PLAYERS = 4;
export const SAY_LESS_MAX_PLAYERS = 14;
export const SAY_LESS_TEAM_MIN = 2;
export const SAY_LESS_TEAM_MAX = 7;
export const SAY_LESS_TURN_SECONDS = 45;
export const SAY_LESS_PREVIEW_SECONDS = 10;
export const SAY_LESS_HOLD_SECONDS = 5;
export const SAY_LESS_CARDS_PER_CATEGORY = 10;
export const SAY_LESS_DECK_SIZE = 20;
export const SAY_LESS_MAX_TURNS_BEFORE_PAUSE = 10;

export const SAY_LESS_CATEGORY_IDS = [
  "automotive-fleet",
  "life-sciences",
  "inventors",
  "musicians",
  "movie-people",
] as const;

export type SayLessCategoryId = (typeof SAY_LESS_CATEGORY_IDS)[number];
export type SayLessTeamLabel = "A" | "B";
export type SayLessPhase =
  | "lobby"
  | "teams"
  | "preview"
  | "ready"
  | "turn"
  | "hold"
  | "round_break"
  | "final_scores";
export type SayLessCardOutcome = "got_it" | "pass" | "oops" | "expired";
export type SayLessEndReason = "timer" | "pile_empty" | "skipped" | "round_ended";

export const SAY_LESS_DEFAULT_CATEGORIES: [SayLessCategoryId, SayLessCategoryId] = [
  "automotive-fleet",
  "movie-people",
];

export const SAY_LESS_CATEGORY_LABELS: Record<SayLessCategoryId, string> = {
  "automotive-fleet": "Automotive & Fleet",
  "life-sciences": "Life Sciences",
  inventors: "Inventors & Innovators",
  musicians: "Musicians",
  "movie-people": "Movie People",
};

export const SAY_LESS_PASS_BLOCKED_ROUND_1 = "No passing or wrong answers in round 1.";

export const SAMPLE_CARD = { name: "PIZZA", hint: "Round, cheesy, sliced" } as const;

export function isCategoryId(value: string): value is SayLessCategoryId {
  return (SAY_LESS_CATEGORY_IDS as readonly string[]).includes(value);
}

export function otherTeam(label: SayLessTeamLabel): SayLessTeamLabel {
  return label === "A" ? "B" : "A";
}

export function shuffleCopy<T>(items: T[], random: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = arr[i];
    const b = arr[j];
    if (a === undefined || b === undefined) continue;
    arr[i] = b;
    arr[j] = a;
  }
  return arr;
}

export function splitTeams(
  participantIds: string[],
  random: () => number = Math.random
): { A: string[]; B: string[] } {
  if (participantIds.length < SAY_LESS_MIN_PLAYERS) {
    throw new Error("Say Less needs at least 4 players.");
  }
  if (participantIds.length > SAY_LESS_MAX_PLAYERS) {
    throw new Error("Say Less caps at 14 players.");
  }
  const shuffled = shuffleCopy(participantIds, random);
  const aSize = Math.ceil(shuffled.length / 2);
  return { A: shuffled.slice(0, aSize), B: shuffled.slice(aSize) };
}

/** Swap two people on different teams; each takes the other's place in order. */
export function swapPlayers(
  teams: { A: string[]; B: string[] },
  first: string,
  second: string
): { ok: true; teams: { A: string[]; B: string[] } } | { ok: false; error: string } {
  if (first === second) return { ok: false, error: "Pick two people." };
  const aIndex = teams.A.indexOf(first) >= 0 ? teams.A.indexOf(first) : teams.A.indexOf(second);
  const bIndex = teams.B.indexOf(first) >= 0 ? teams.B.indexOf(first) : teams.B.indexOf(second);
  if (aIndex < 0 || bIndex < 0) {
    return { ok: false, error: "Pick one person from each team." };
  }
  const A = [...teams.A];
  const B = [...teams.B];
  const fromA = A[aIndex]!;
  A[aIndex] = B[bIndex]!;
  B[bIndex] = fromA;
  return { ok: true, teams: { A, B } };
}

export function drawDeck(
  cards: { id: string; category: SayLessCategoryId; active: boolean }[],
  categoryA: SayLessCategoryId,
  categoryB: SayLessCategoryId,
  random: () => number = Math.random
): string[] {
  if (categoryA === categoryB) {
    throw new Error("Pick two different categories.");
  }
  const take = (category: SayLessCategoryId): string[] =>
    shuffleCopy(
      cards.filter((card) => card.active && card.category === category).map((card) => card.id),
      random
    ).slice(0, SAY_LESS_CARDS_PER_CATEGORY);

  const a = take(categoryA);
  const b = take(categoryB);
  if (a.length < SAY_LESS_CARDS_PER_CATEGORY || b.length < SAY_LESS_CARDS_PER_CATEGORY) {
    throw new Error("Need 10 active cards in each chosen category.");
  }
  return shuffleCopy([...a, ...b], random);
}

/**
 * Shuffle the deck, then deal two consecutive cards per player, wrapping so
 * coverage is maximal and a player's two cards are distinct.
 */
export function dealPreviews(
  deckIds: string[],
  participantIds: string[],
  random: () => number = Math.random
): Record<string, [string, string]> {
  if (deckIds.length < 2) {
    throw new Error("Need at least two cards to preview.");
  }
  const shuffled = shuffleCopy(deckIds, random);
  const result: Record<string, [string, string]> = {};
  for (let i = 0; i < participantIds.length; i++) {
    const first = shuffled[(i * 2) % shuffled.length]!;
    let second = shuffled[(i * 2 + 1) % shuffled.length]!;
    if (second === first) {
      second = shuffled[(i * 2 + 2) % shuffled.length]!;
    }
    result[participantIds[i]!] = [first, second];
  }
  return result;
}

export function applyPileOutcome(pile: string[], outcome: SayLessCardOutcome): string[] {
  if (pile.length === 0) return pile;
  const top = pile[0]!;
  const rest = pile.slice(1);
  if (outcome === "got_it") return rest;
  return [...rest, top];
}

/**
 * If nobody in the session is marked connected, treat everyone as present
 * (presence is not always wired). Otherwise only connected ids count.
 */
export function liveMemberIds(
  memberIds: string[],
  connectedById: Record<string, boolean>
): string[] {
  const anyConnected = Object.values(connectedById).some(Boolean);
  if (!anyConnected) return [...memberIds];
  return memberIds.filter((id) => connectedById[id] === true);
}

export function pickClueGiver(
  memberIds: string[],
  cursor: number,
  connectedById: Record<string, boolean>
): { giverId: string | null; nextCursor: number } {
  if (memberIds.length === 0) return { giverId: null, nextCursor: 0 };
  const live = liveMemberIds(memberIds, connectedById);
  if (live.length === 0) return { giverId: null, nextCursor: cursor };
  const start = ((cursor % memberIds.length) + memberIds.length) % memberIds.length;
  for (let step = 0; step < memberIds.length; step++) {
    const index = (start + step) % memberIds.length;
    const id = memberIds[index]!;
    if (live.includes(id)) {
      return { giverId: id, nextCursor: (index + 1) % memberIds.length };
    }
  }
  return { giverId: null, nextCursor: cursor };
}

export function deadlinePassed(deadlineIso: string | null, nowMs: number): boolean {
  if (!deadlineIso) return false;
  const deadline = new Date(deadlineIso).getTime();
  if (Number.isNaN(deadline)) return false;
  return nowMs >= deadline;
}

export function deadlineFromNow(seconds: number, nowMs: number = Date.now()): string {
  return new Date(nowMs + seconds * 1000).toISOString();
}

export function cardsPerTurn(gotIt: number, countedTurns: number): number | null {
  if (countedTurns <= 0) return null;
  return gotIt / countedTurns;
}

/** Whole-number team score: cards guessed on that team's turns. */
export function teamScores(
  turns: { id: string; round: 1 | 2; team_id: string }[],
  events: { turn_id: string; outcome: SayLessCardOutcome }[],
  teamIds: { A: string; B: string },
  round?: 1 | 2
): { A: number; B: number } {
  const teamByTurn = new Map<string, string>();
  for (const turn of turns) {
    if (round == null || turn.round === round) teamByTurn.set(turn.id, turn.team_id);
  }
  const scores = { A: 0, B: 0 };
  for (const event of events) {
    if (event.outcome !== "got_it") continue;
    const teamId = teamByTurn.get(event.turn_id);
    if (teamId === teamIds.A) scores.A += 1;
    else if (teamId === teamIds.B) scores.B += 1;
  }
  return scores;
}

export function winnerLabel(scores: { A: number; B: number }): SayLessTeamLabel | null {
  if (scores.A === scores.B) return null;
  return scores.A > scores.B ? "A" : "B";
}

export function canPassInRound(round: 1 | 2): boolean {
  return round === 2;
}

/** Pause HOLD after this many counted turns, including the one just ending. */
export function shouldPauseAfterTurns(endedIncludingCurrent: number): boolean {
  return endedIncludingCurrent >= SAY_LESS_MAX_TURNS_BEFORE_PAUSE;
}

export function sessionProgress(input: {
  round1GotIt: number;
  round2GotIt: number;
  round1EndedEarly: boolean;
  round2EndedEarly: boolean;
  phase: SayLessPhase;
}): number {
  if (input.phase === "final_scores") return 1;
  const r1 = input.round1EndedEarly ? SAY_LESS_DECK_SIZE : input.round1GotIt;
  const r2 = input.round2EndedEarly ? SAY_LESS_DECK_SIZE : input.round2GotIt;
  return Math.min(1, (r1 + r2) / (SAY_LESS_DECK_SIZE * 2));
}

export function isFacilitatorHold(phase: SayLessPhase, paused: boolean): boolean {
  if (
    phase === "lobby" ||
    phase === "teams" ||
    phase === "ready" ||
    phase === "round_break" ||
    phase === "final_scores"
  ) {
    return true;
  }
  return phase === "hold" && paused;
}

export function cardForViewer<T>(
  viewerId: string,
  clueGiverId: string | null,
  card: T
): T | null {
  if (!clueGiverId || viewerId !== clueGiverId) return null;
  return card;
}

export function playInstruction(round: 1 | 2): string {
  return round === 1
    ? "Say anything except the words on the card. No derivatives, no spelling."
    : "One-word clues only. No derivatives. One guess.";
}

export function roleLine(kind: "clue" | "guess" | "listen", round: 1 | 2): string {
  if (kind === "clue") {
    return round === 1
      ? "Tap Got it when your team guesses it."
      : "Got it, or Pass / Oops if they miss or you're stuck.";
  }
  if (kind === "guess") {
    return round === 1 ? "Guess out loud. As many guesses as you want." : "One guess only.";
  }
  return "Stay muted. Listen.";
}

/** In-memory expire step for the engine liveness test. */
export type SayLessSimGame = {
  phase: SayLessPhase;
  paused: boolean;
  deadlineMs: number | null;
  pile: string[];
  nextTeam: SayLessTeamLabel;
  teams: Record<SayLessTeamLabel, { members: string[]; cursor: number }>;
  connected: Record<string, boolean>;
  countedTurns: number;
  round: 1 | 2;
};

export function expireSimOnce(game: SayLessSimGame, nowMs: number): SayLessSimGame {
  if (game.paused || game.deadlineMs == null || nowMs < game.deadlineMs) return game;
  if (game.phase === "preview") {
    return { ...game, phase: "ready", deadlineMs: null };
  }
  if (game.phase === "turn") {
    const countedTurns = game.countedTurns + 1;
    const pause = shouldPauseAfterTurns(countedTurns);
    return {
      ...game,
      pile: applyPileOutcome(game.pile, "expired"),
      phase: "hold",
      countedTurns,
      paused: pause,
      deadlineMs: pause ? null : nowMs + SAY_LESS_HOLD_SECONDS * 1000,
    };
  }
  if (game.phase === "hold") {
    return beginTurnSim(game, nowMs);
  }
  return game;
}

export function expireSimUntilHold(game: SayLessSimGame, nowMs: number): SayLessSimGame {
  let current = game;
  for (let step = 0; step < 40; step++) {
    const next = expireSimOnce(current, nowMs + step);
    if (next === current) break;
    current = next;
    if (isFacilitatorHold(current.phase, current.paused)) break;
  }
  return current;
}

function beginTurnSim(game: SayLessSimGame, nowMs: number): SayLessSimGame {
  const first = game.nextTeam;
  const second = otherTeam(first);
  for (const label of [first, second] as const) {
    const team = game.teams[label];
    const pick = pickClueGiver(team.members, team.cursor, game.connected);
    if (!pick.giverId) continue;
    return {
      ...game,
      phase: "turn",
      nextTeam: otherTeam(label),
      teams: {
        ...game.teams,
        [label]: { ...team, cursor: pick.nextCursor },
      },
      deadlineMs: nowMs + SAY_LESS_TURN_SECONDS * 1000,
      paused: false,
    };
  }
  return { ...game, paused: true, deadlineMs: null };
}
