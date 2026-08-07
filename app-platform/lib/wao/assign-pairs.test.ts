import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assignPairs,
  pairKey,
  type PairHistory,
  type Pairing,
  type RoundAssignmentSuccess,
} from "./assign-pairs";

function ids(n: number, prefix = "p"): string[] {
  return Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);
}

function emptyHistory(): PairHistory {
  return { pairs: [], sitOuts: [] };
}

/** Deterministic RNG for reproducible tests (mulberry32). */
function seededRandom(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function assertSuccess(
  result: ReturnType<typeof assignPairs>
): RoundAssignmentSuccess {
  assert.equal(result.ok, true, `expected success, got ${JSON.stringify(result)}`);
  return result as RoundAssignmentSuccess;
}

function assertFailure(result: ReturnType<typeof assignPairs>): void {
  assert.equal(result.ok, false, `expected failure, got ${JSON.stringify(result)}`);
}

/** Accumulate history across successive successful rounds. */
function playRounds(
  roster: string[],
  roundCount: number,
  random: () => number = seededRandom(1)
): { assignments: RoundAssignmentSuccess[]; history: PairHistory } {
  const pairs: Pairing[] = [];
  const sitOuts: string[] = [];
  const assignments: RoundAssignmentSuccess[] = [];

  for (let r = 0; r < roundCount; r++) {
    const result = assignPairs(roster, { pairs, sitOuts }, { random });
    const success = assertSuccess(result);
    assignments.push(success);
    for (const pair of success.pairs) {
      pairs.push([pair.participantA, pair.participantB]);
    }
    if (success.sitOut !== null) {
      sitOuts.push(success.sitOut);
    }
  }

  return { assignments, history: { pairs, sitOuts } };
}

function allPairKeys(assignments: RoundAssignmentSuccess[]): string[] {
  const keys: string[] = [];
  for (const a of assignments) {
    for (const pair of a.pairs) {
      keys.push(pairKey(pair.participantA, pair.participantB));
    }
  }
  return keys;
}

function assertNoRepeatPairs(assignments: RoundAssignmentSuccess[]): void {
  const keys = allPairKeys(assignments);
  assert.equal(new Set(keys).size, keys.length, `repeat pairing: ${keys.join(", ")}`);
}

function assertRosterCovered(
  roster: string[],
  assignment: RoundAssignmentSuccess
): void {
  const seen = new Set<string>();
  for (const pair of assignment.pairs) {
    assert.notEqual(pair.participantA, pair.participantB);
    assert.ok(!seen.has(pair.participantA), `duplicate ${pair.participantA}`);
    assert.ok(!seen.has(pair.participantB), `duplicate ${pair.participantB}`);
    seen.add(pair.participantA);
    seen.add(pair.participantB);
  }
  if (assignment.sitOut !== null) {
    assert.ok(!seen.has(assignment.sitOut), "sit-out also paired");
    seen.add(assignment.sitOut);
  }
  assert.equal(seen.size, roster.length);
  for (const id of roster) {
    assert.ok(seen.has(id), `missing ${id}`);
  }
}

function assertSitOutRotation(
  roster: string[],
  assignments: RoundAssignmentSuccess[]
): void {
  const sitOuts = assignments
    .map((a) => a.sitOut)
    .filter((id): id is string => id !== null);

  // Until everyone has sat out once, no repeats.
  const firstWave = sitOuts.slice(0, roster.length);
  assert.equal(
    new Set(firstWave).size,
    firstWave.length,
    `sit-out repeated before full rotation: ${firstWave.join(", ")}`
  );

  // Over the whole run, counts differ by at most 1.
  const counts = new Map<string, number>();
  for (const id of roster) counts.set(id, 0);
  for (const id of sitOuts) counts.set(id, (counts.get(id) ?? 0) + 1);
  const values = Array.from(counts.values());
  const min = Math.min(...values);
  const max = Math.max(...values);
  assert.ok(max - min <= 1, `sit-out counts uneven: ${JSON.stringify(Array.from(counts))}`);
}

describe("assignPairs", () => {
  it("is deterministic for the same inputs and RNG", () => {
    const roster = ids(8);
    const history: PairHistory = {
      pairs: [
        ["p1", "p2"],
        ["p3", "p4"],
      ],
      sitOuts: [],
    };
    const a = assignPairs(roster, history, { random: seededRandom(42) });
    const b = assignPairs(roster, history, { random: seededRandom(42) });
    assert.deepEqual(a, b);
  });

  it("even headcount, 4 rounds, no pairing repeats", () => {
    const roster = ids(8);
    const { assignments } = playRounds(roster, 4);
    assert.equal(assignments.length, 4);
    for (const a of assignments) {
      assert.equal(a.sitOut, null);
      assert.equal(a.pairs.length, 4);
      assertRosterCovered(roster, a);
    }
    assertNoRepeatPairs(assignments);
  });

  it("odd headcount at 11, 4 rounds, no repeats, sit-outs distributed", () => {
    const roster = ids(11);
    const { assignments } = playRounds(roster, 4);
    for (const a of assignments) {
      assert.notEqual(a.sitOut, null);
      assert.equal(a.pairs.length, 5);
      assertRosterCovered(roster, a);
    }
    assertNoRepeatPairs(assignments);
    assertSitOutRotation(roster, assignments);
  });

  it("odd headcount at 13, 4 rounds, no repeats, sit-outs distributed", () => {
    const roster = ids(13);
    const { assignments } = playRounds(roster, 4);
    for (const a of assignments) {
      assert.notEqual(a.sitOut, null);
      assert.equal(a.pairs.length, 6);
      assertRosterCovered(roster, a);
    }
    assertNoRepeatPairs(assignments);
    assertSitOutRotation(roster, assignments);
  });

  it("4 participants over 5 rounds: always succeeds; novel pairs first", () => {
    const roster = ids(4);
    const { assignments } = playRounds(roster, 5);
    assert.equal(assignments.length, 5);
    for (const a of assignments) {
      assert.equal(a.ok, true);
      assert.equal(a.sitOut, null);
      assert.equal(a.pairs.length, 2);
      assertRosterCovered(roster, a);
    }
    // K4 has three perfect matchings / six edges; first three rounds use
    // each edge once — no repeats until the novel set is exhausted.
    assertNoRepeatPairs(assignments.slice(0, 3));
  });

  it("4 participants over 6 rounds: always ok; repeats spread evenly", () => {
    const roster = ids(4);
    const { assignments } = playRounds(roster, 6, seededRandom(7));
    for (const a of assignments) {
      assert.equal(a.ok, true);
      assertRosterCovered(roster, a);
    }

    // Six rounds × two pairs = twelve pair-instances across six edges of K4.
    // Minimum-cost matching should leave every edge used the same number of
    // times (twice), not concentrate repeats on one pair.
    const counts = new Map<string, number>();
    for (const key of allPairKeys(assignments)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const values = Array.from(counts.values());
    assert.equal(counts.size, 6, `expected all 6 edges, got ${[...counts.keys()]}`);
    const min = Math.min(...values);
    const max = Math.max(...values);
    assert.equal(min, 2);
    assert.equal(max, 2);
  });

  it("5 participants over 5 rounds: sit-out rotates once each", () => {
    const roster = ids(5);
    const { assignments } = playRounds(roster, 5);
    for (const a of assignments) {
      assert.notEqual(a.sitOut, null);
      assert.equal(a.pairs.length, 2);
      assertRosterCovered(roster, a);
    }
    assertSitOutRotation(roster, assignments);
    const sitOuts = assignments.map((a) => a.sitOut!);
    assert.equal(new Set(sitOuts).size, 5);
  });

  it("2 participants over 3 rounds: same pair every round, no error", () => {
    const roster = ids(2);
    const { assignments } = playRounds(roster, 3);
    assert.equal(assignments.length, 3);
    for (const a of assignments) {
      assert.equal(a.ok, true);
      assert.equal(a.sitOut, null);
      assert.equal(a.pairs.length, 1);
      assert.deepEqual(a.pairs[0], {
        participantA: "p1",
        participantB: "p2",
      });
    }
  });

  it("one participant: solo sit-out every round", () => {
    const roster = ids(1);
    const first = assertSuccess(assignPairs(roster, emptyHistory()));
    assert.deepEqual(first.pairs, []);
    assert.equal(first.sitOut, "p1");

    const second = assertSuccess(
      assignPairs(roster, { pairs: [], sitOuts: ["p1"] })
    );
    assert.deepEqual(second.pairs, []);
    assert.equal(second.sitOut, "p1");
  });

  it("zero participants: failure, not throw", () => {
    assertFailure(assignPairs([]));
    assertFailure(assignPairs([], emptyHistory()));
  });

  it("prefers never-paired edges over repeating when both are possible", () => {
    const roster = ["a", "b", "c", "d"];
    const history: PairHistory = {
      pairs: [
        ["b", "a"],
        ["d", "c"],
      ],
      sitOuts: [],
    };
    const result = assertSuccess(
      assignPairs(roster, history, { random: seededRandom(1) })
    );
    const keys = result.pairs.map((p) =>
      pairKey(p.participantA, p.participantB)
    );
    assert.ok(!keys.includes(pairKey("a", "b")));
    assert.ok(!keys.includes(pairKey("c", "d")));
  });

  it("pairKey normalises order", () => {
    assert.equal(pairKey("a", "b"), pairKey("b", "a"));
    assert.notEqual(pairKey("a", "b"), pairKey("a", "c"));
  });

  it("sit-out prefers people who have not sat out yet", () => {
    const roster = ids(5);
    const history: PairHistory = {
      pairs: [
        ["p2", "p3"],
        ["p4", "p5"],
      ],
      sitOuts: ["p1"],
    };
    const result = assertSuccess(
      assignPairs(roster, history, { random: seededRandom(99) })
    );
    assert.notEqual(result.sitOut, "p1");
    assert.ok(roster.includes(result.sitOut!));
  });
});
