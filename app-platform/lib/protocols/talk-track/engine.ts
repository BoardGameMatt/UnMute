/**
 * Pure Talk Track helpers — formation, names, guesser pool, starter rotation, scoring.
 * No I/O. Safe for unit tests.
 */

export const TALK_TRACK_TEAM_NAMES = [
  "The Openers",
  "The Anchors",
  "The Last Words",
  "The Closers",
  "The Throughlines",
  "The Headlines",
  "The Asides",
  "The Prompts",
] as const;

export const TALK_TRACK_MIN_PLAYERS = 4;
export const TALK_TRACK_MAX_PLAYERS = 20;
export const TALK_TRACK_TURN_SECONDS = 60;
export const TALK_TRACK_HOLD_SECONDS = 5;
export const TALK_TRACK_MANDATORY_CYCLES = 2;

export type TalkTrackEndReason = "all_five" | "timer" | "abandoned" | "skipped";
export type TalkTrackWordOutcome = "scored" | "passed" | "expired" | "unset";

export function computeTeamSizes(playerCount: number): number[] {
  if (playerCount < TALK_TRACK_MIN_PLAYERS) {
    throw new Error("Talk Track needs at least 4 players.");
  }
  if (playerCount > TALK_TRACK_MAX_PLAYERS) {
    throw new Error("Talk Track caps at 20 players.");
  }

  const teamCount = Math.floor(playerCount / 4);
  const base = Math.floor(playerCount / teamCount);
  const remainder = playerCount % teamCount;
  const sizes: number[] = [];
  for (let i = 0; i < teamCount; i++) {
    sizes.push(i < remainder ? base + 1 : base);
  }
  return sizes;
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

export function assignTeamNames(
  teamCount: number,
  random: () => number = Math.random
): string[] {
  if (teamCount < 1) return [];
  if (teamCount > TALK_TRACK_TEAM_NAMES.length) {
    throw new Error("Talk Track has eight team names; a room never has more than five teams.");
  }
  return shuffleCopy([...TALK_TRACK_TEAM_NAMES], random).slice(0, teamCount);
}

export function formTeams(
  participantIds: string[],
  random: () => number = Math.random
): { name: string; memberIds: string[] }[] {
  const shuffled = shuffleCopy(participantIds, random);
  const sizes = computeTeamSizes(shuffled.length);
  const names = assignTeamNames(sizes.length, random);
  const teams: { name: string; memberIds: string[] }[] = [];
  let offset = 0;
  for (let i = 0; i < sizes.length; i++) {
    const size = sizes[i] ?? 0;
    teams.push({
      name: names[i] ?? TALK_TRACK_TEAM_NAMES[i] ?? "The Openers",
      memberIds: shuffled.slice(offset, offset + size),
    });
    offset += size;
  }
  return teams;
}

/** No repeat guesser until everyone on the team has guessed once. */
export function pickGuesser(
  memberIds: string[],
  priorGuesserIds: string[],
  random: () => number = Math.random
): string {
  if (memberIds.length === 0) {
    throw new Error("Cannot pick a guesser from an empty team.");
  }
  const guessed = new Set(priorGuesserIds.filter((id) => memberIds.includes(id)));
  const eligible = memberIds.filter((id) => !guessed.has(id));
  const pool = eligible.length > 0 ? eligible : memberIds;
  const index = Math.floor(random() * pool.length);
  return pool[index] ?? pool[0]!;
}

/** 1-based slot. Starter rotates each word even if Stop landed mid-cycle. */
export function starterIndex(slot: number, trainLength: number): number {
  if (trainLength < 1) return 0;
  const s = Math.min(5, Math.max(1, slot));
  return (s - 1) % trainLength;
}

export function slotPoints(slot: number): number {
  if (slot < 1 || slot > 5) return 0;
  return slot;
}

export function turnPointsFromOutcomes(outcomes: TalkTrackWordOutcome[]): number {
  let total = 0;
  outcomes.forEach((outcome, i) => {
    if (outcome === "scored") total += slotPoints(i + 1);
  });
  return total;
}

export function teamScore(wordPoints: number, nudgeDeltas: number[]): number {
  return wordPoints + nudgeDeltas.reduce((sum, d) => sum + d, 0);
}

export function timerHasExpired(startedAtIso: string, nowMs: number, seconds = TALK_TRACK_TURN_SECONDS): boolean {
  const start = new Date(startedAtIso).getTime();
  if (Number.isNaN(start)) return false;
  return nowMs >= start + seconds * 1000;
}

export function holdIsReady(holdStartedAtIso: string, nowMs: number, seconds = TALK_TRACK_HOLD_SECONDS): boolean {
  const start = new Date(holdStartedAtIso).getTime();
  if (Number.isNaN(start)) return false;
  return nowMs >= start + seconds * 1000;
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

/** Guesser never receives the five words. Everyone else may. */
export function wordsForViewer<T>(
  viewerId: string,
  guesserId: string | null,
  words: T
): T | null {
  if (guesserId && viewerId === guesserId) return null;
  return words;
}
