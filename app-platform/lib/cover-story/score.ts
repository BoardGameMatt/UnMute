import { COVER_STORY_MISSION_POINTS } from "./types";

/** Type 1: being guessed. Zero if nobody or everybody is right. Peak near half. */
export function type1Score(k: number, n: number): number {
  if (n <= 0 || k < 0 || k > n) return 0;
  return k * (n - k);
}

/** Type 2: a correct guess of this target. Worth more when few people got it. */
export function type2Score(k: number, n: number): number {
  if (n <= 0 || k <= 0 || k > n) return 0;
  return n - k;
}

export function missionScore(allFivePlanted: boolean): number {
  return allFivePlanted ? COVER_STORY_MISSION_POINTS : 0;
}

export function fisherYates<T>(items: readonly T[], random = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const swap = copy[i];
    copy[i] = copy[j] as T;
    copy[j] = swap as T;
  }
  return copy;
}

export function pickHand(
  availableIds: readonly number[],
  count: number,
  random = Math.random
): number[] {
  if (availableIds.length < count) {
    throw new Error("Not enough unshown agencies remain.");
  }
  return fisherYates(availableIds, random).slice(0, count);
}

/** One shuffle, then contiguous hands. No agency is shown to two players. */
export function pickDisjointHands(
  availableIds: readonly number[],
  playerCount: number,
  handSize: number,
  random = Math.random
): number[][] {
  if (playerCount < 0 || handSize <= 0) {
    throw new Error("Invalid hand size.");
  }
  const need = playerCount * handSize;
  if (availableIds.length < need) {
    throw new Error("Not enough unshown agencies remain.");
  }
  const shuffled = fisherYates(availableIds, random);
  const hands: number[][] = [];
  for (let i = 0; i < playerCount; i += 1) {
    hands.push(shuffled.slice(i * handSize, (i + 1) * handSize));
  }
  return hands;
}
