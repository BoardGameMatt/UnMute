/**
 * Wrong Answers Only pairing (spec §5 as amended by §17, plus §3.6 sit-outs).
 *
 * Pure function: no I/O, no randomness. Same inputs always produce the same
 * result. History is passed in by the caller.
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

const emptyHistory = (): PairHistory => ({ pairs: [], sitOuts: [] });

/** Canonical key so {A,B} and {B,A} compare equal. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function buildForbidden(history: PairHistory): Set<string> {
  const forbidden = new Set<string>();
  for (const [a, b] of history.pairs) {
    if (a === b) continue;
    forbidden.add(pairKey(a, b));
  }
  return forbidden;
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
 * Preserves input order so the search is deterministic.
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

/**
 * Perfect matching on an even-sized ordered list, avoiding forbidden edges.
 * Tries partners in list order and backtracks. Deterministic.
 */
function findMatching(
  ids: readonly string[],
  forbidden: ReadonlySet<string>
): Pairing[] | null {
  if (ids.length === 0) return [];
  if (ids.length % 2 !== 0) return null;

  const first = ids[0];
  if (first === undefined) return [];

  for (let i = 1; i < ids.length; i++) {
    const partner = ids[i];
    if (partner === undefined) continue;
    if (forbidden.has(pairKey(first, partner))) continue;

    const remaining: string[] = [];
    for (let j = 1; j < ids.length; j++) {
      if (j === i) continue;
      const id = ids[j];
      if (id !== undefined) remaining.push(id);
    }

    const rest = findMatching(remaining, forbidden);
    if (rest !== null) {
      return [[first, partner], ...rest];
    }
  }

  return null;
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
 * Constraints (spec §17):
 * 1. No repeat pairings within the session.
 * 2. Even sit-out distribution: nobody sits out twice until everyone has once.
 *
 * No relaxation. If no valid assignment exists, returns `{ ok: false, reason }`.
 * Deterministic: no randomness; candidates are tried in input order.
 */
export function assignPairs(
  participantIds: readonly string[],
  history: PairHistory = emptyHistory()
): RoundAssignment {
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
  const forbidden = buildForbidden(history);

  if (roster.length % 2 === 0) {
    const matching = findMatching(roster, forbidden);
    if (matching === null) {
      return {
        ok: false,
        reason:
          "No valid pairing exists without repeating a pair from earlier in this session.",
      };
    }
    return {
      ok: true,
      pairs: toAssignedPairs(matching, orderIndex),
      sitOut: null,
    };
  }

  // Odd headcount: one sit-out, then a perfect matching on the rest.
  const candidates = eligibleSitOuts(roster, history);
  for (const sitOut of candidates) {
    const remaining = roster.filter((id) => id !== sitOut);
    const matching = findMatching(remaining, forbidden);
    if (matching !== null) {
      return {
        ok: true,
        pairs: toAssignedPairs(matching, orderIndex),
        sitOut,
      };
    }
  }

  return {
    ok: false,
    reason:
      "No valid pairing and sit-out exists under the no-repeat and sit-out rotation rules.",
  };
}
