/**
 * Wrong Answers Only pairing (spec §5 as amended by §17, plus §3.6 sit-outs).
 *
 * Pure aside from optional randomness for tie-breaks. History is passed in
 * by the caller. Always returns a pairing for a non-empty roster; repeats
 * are preferred by least-recent (minimum total prior-pair cost), not banned.
 */

/** Unordered pairing. Callers may pass either order; comparisons normalise. */
export type Pairing = readonly [string, string];

export type PairHistory = {
  /** Past pairings across prior rounds. Order within each pair does not matter. */
  pairs: ReadonlyArray<Pairing>;
  /** Past sit-out ids, one entry per odd-headcount round that had a sit-out. */
  sitOuts: ReadonlyArray<string>;
};

export type AssignedPair = {
  participantA: string;
  participantB: string;
};

export type RoundAssignmentSuccess = {
  ok: true;
  pairs: AssignedPair[];
  /** Null when headcount is even. */
  sitOut: string | null;
};

export type RoundAssignmentFailure = {
  ok: false;
  reason: string;
};

export type RoundAssignment = RoundAssignmentSuccess | RoundAssignmentFailure;

export type AssignPairsOptions = {
  /** Returns a float in [0, 1). Defaults to Math.random. */
  random?: () => number;
};

const emptyHistory = (): PairHistory => ({ pairs: [], sitOuts: [] });

/** Canonical key so {A,B} and {B,A} compare equal. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Prior occurrence count per unordered pair. Missing key ⇒ cost 0. */
function buildPairCosts(history: PairHistory): Map<string, number> {
  const costs = new Map<string, number>();
  for (const [a, b] of history.pairs) {
    if (a === b) continue;
    const key = pairKey(a, b);
    costs.set(key, (costs.get(key) ?? 0) + 1);
  }
  return costs;
}

function edgeCost(costs: ReadonlyMap<string, number>, a: string, b: string): number {
  return costs.get(pairKey(a, b)) ?? 0;
}

/**
 * Sit-out count per id among the current roster only. New joiners start at 0.
 */
function sitOutCounts(
  participantIds: readonly string[],
  history: PairHistory
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of participantIds) counts.set(id, 0);
  for (const id of history.sitOuts) {
    if (counts.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/**
 * Eligible sit-outs: everyone at the current minimum sit-out count.
 * Preserves input order until the caller shuffles.
 */
function eligibleSitOuts(
  participantIds: readonly string[],
  history: PairHistory
): string[] {
  const counts = sitOutCounts(participantIds, history);
  let min = Number.POSITIVE_INFINITY;
  for (const id of participantIds) {
    const c = counts.get(id) ?? 0;
    if (c < min) min = c;
  }
  return participantIds.filter((id) => (counts.get(id) ?? 0) === min);
}

function shuffleInPlace<T>(items: T[], random: () => number): void {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
}

/**
 * Perfect matching on an even-sized list that minimises total prior-pair cost.
 * Among minimum-cost matchings, picks one at random via `random`.
 */
function findMinCostMatching(
  ids: readonly string[],
  costs: ReadonlyMap<string, number>,
  random: () => number
): Pairing[] {
  if (ids.length === 0) return [];
  if (ids.length % 2 !== 0) {
    throw new Error("findMinCostMatching requires an even-sized list");
  }

  let bestCost = Number.POSITIVE_INFINITY;
  const bestMatchings: Pairing[][] = [];

  const dfs = (
    remaining: readonly string[],
    current: Pairing[],
    costSoFar: number
  ): void => {
    if (remaining.length === 0) {
      if (costSoFar < bestCost) {
        bestCost = costSoFar;
        bestMatchings.length = 0;
        bestMatchings.push(current.map((p) => [p[0], p[1]] as Pairing));
      } else if (costSoFar === bestCost) {
        bestMatchings.push(current.map((p) => [p[0], p[1]] as Pairing));
      }
      return;
    }
    if (costSoFar > bestCost) return;

    const first = remaining[0];
    if (first === undefined) return;

    for (let i = 1; i < remaining.length; i += 1) {
      const partner = remaining[i];
      if (partner === undefined) continue;
      const nextCost = costSoFar + edgeCost(costs, first, partner);
      if (nextCost > bestCost) continue;

      const nextRemaining: string[] = [];
      for (let j = 1; j < remaining.length; j += 1) {
        if (j === i) continue;
        const id = remaining[j];
        if (id !== undefined) nextRemaining.push(id);
      }

      current.push([first, partner]);
      dfs(nextRemaining, current, nextCost);
      current.pop();
    }
  };

  dfs(ids, [], 0);

  if (bestMatchings.length === 0) {
    throw new Error("No perfect matching found for even roster");
  }

  const pick = Math.floor(random() * bestMatchings.length);
  return bestMatchings[pick] ?? bestMatchings[0]!;
}

function toAssignedPairs(
  matching: Pairing[],
  orderIndex: Map<string, number>
): AssignedPair[] {
  const pairs: AssignedPair[] = matching.map(([a, b]) => {
    const aIdx = orderIndex.get(a) ?? 0;
    const bIdx = orderIndex.get(b) ?? 0;
    return aIdx <= bIdx
      ? { participantA: a, participantB: b }
      : { participantA: b, participantB: a };
  });

  pairs.sort((left, right) => {
    const leftIdx = orderIndex.get(left.participantA) ?? 0;
    const rightIdx = orderIndex.get(right.participantA) ?? 0;
    return leftIdx - rightIdx;
  });

  return pairs;
}

/**
 * Assign pairs (and optional sit-out) for the next round.
 *
 * Among all complete pairings of the present roster, chooses one that
 * minimises the total number of prior pairings across pairs. Ties break
 * randomly. Sit-out prefers whoever has sat out fewest times; ties break
 * randomly. Always succeeds for a non-empty roster.
 */
export function assignPairs(
  participantIds: readonly string[],
  history: PairHistory = emptyHistory(),
  options?: AssignPairsOptions
): RoundAssignment {
  const random = options?.random ?? Math.random;

  if (participantIds.length === 0) {
    return { ok: false, reason: "No participants to pair." };
  }

  // Preserve first-seen order; drop duplicate ids so a bad caller cannot
  // produce an odd roster from repeats.
  const seen = new Set<string>();
  const roster: string[] = [];
  for (const id of participantIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    roster.push(id);
  }

  const orderIndex = new Map(roster.map((id, i) => [id, i]));
  const costs = buildPairCosts(history);

  if (roster.length % 2 === 0) {
    const matching = findMinCostMatching(roster, costs, random);
    return {
      ok: true,
      pairs: toAssignedPairs(matching, orderIndex),
      sitOut: null,
    };
  }

  // Odd headcount: pick sit-out first (fewest prior sit-outs, random among
  // ties), then min-cost match the rest.
  const candidates = eligibleSitOuts(roster, history);
  shuffleInPlace(candidates, random);
  const sitOut = candidates[0];
  if (sitOut === undefined) {
    return { ok: false, reason: "No participants to pair." };
  }

  const remaining = roster.filter((id) => id !== sitOut);
  const matching = findMinCostMatching(remaining, costs, random);
  return {
    ok: true,
    pairs: toAssignedPairs(matching, orderIndex),
    sitOut,
  };
}
