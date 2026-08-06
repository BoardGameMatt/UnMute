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
  roundCount: number
): { assignments: RoundAssignmentSuccess[]; history: PairHistory } {
  const pairs: Pairing[] = [];
  const sitOuts: string[] = [];
  const assignments: RoundAssignmentSuccess[] = [];

  for (let r = 0; r < roundCount; r++) {
    const result = assignPairs(roster, { pairs, sitOuts });
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
  it("is deterministic for the same inputs", () => {
    const roster = ids(8);
    const history: PairHistory = {
      pairs: [
        ["p1", "p2"],
        ["p3", "p4"],
      ],
      sitOuts: [],
    };
    const a = assignPairs(roster, history);
    const b = assignPairs(roster, history);
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

  it("4 participants over 4 rounds: round 4 fails rather than repeating", () => {
    const roster = ids(4);
    // K_4 has exactly three perfect matchings; the fourth round must fail.
    const { assignments, history } = playRounds(roster, 3);
    assert.equal(assignments.length, 3);
    assertNoRepeatPairs(assignments);

    const fourth = assignPairs(roster, history);
    assertFailure(fourth);
    if (!fourth.ok) {
      assert.match(fourth.reason, /no valid pairing/i);
    }
  });

  it("two participants: first round pairs them, second fails", () => {
    const roster = ids(2);
    const first = assertSuccess(assignPairs(roster, emptyHistory()));
    assert.equal(first.pairs.length, 1);
    assert.equal(first.sitOut, null);
    assert.deepEqual(first.pairs[0], {
      participantA: "p1",
      participantB: "p2",
    });

    const history: PairHistory = {
      pairs: [["p1", "p2"]],
      sitOuts: [],
    };
    assertFailure(assignPairs(roster, history));
  });

  it("one participant: solo sit-out every round", () => {
    const roster = ids(1);
    const first = assertSuccess(assignPairs(roster, emptyHistory()));
    assert.deepEqual(first.pairs, []);
    assert.equal(first.sitOut, "p1");

    // Everyone has sat out once, so sitting out again is allowed.
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

  it("unordered pairing equivalence: {A,B} in history blocks {B,A}", () => {
    const roster = ["a", "b", "c", "d"];
    // Seed history with the reverse of the only matching that uses a-b.
    const history: PairHistory = {
      pairs: [
        ["b", "a"],
        ["d", "c"],
      ],
      sitOuts: [],
    };
    const result = assignPairs(roster, history);
    const success = assertSuccess(result);
    const keys = success.pairs.map((p) =>
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
    const result = assertSuccess(assignPairs(roster, history));
    assert.notEqual(result.sitOut, "p1");
    assert.ok(roster.includes(result.sitOut!));
  });
});
