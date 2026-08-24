import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  TALK_TRACK_TEAM_NAMES,
  assignTeamNames,
  computeTeamSizes,
  formTeams,
  holdIsReady,
  liveMemberIds,
  pickGuesser,
  slotPoints,
  starterIndex,
  teamScore,
  timerHasExpired,
  turnPointsFromOutcomes,
  wordsForViewer,
} from "./engine";

const SIZE_CASES: { n: number; teamCount: number; sizes: number[] }[] = [
  { n: 4, teamCount: 1, sizes: [4] },
  { n: 5, teamCount: 1, sizes: [5] },
  { n: 6, teamCount: 1, sizes: [6] },
  { n: 7, teamCount: 1, sizes: [7] },
  { n: 8, teamCount: 2, sizes: [4, 4] },
  { n: 9, teamCount: 2, sizes: [5, 4] },
  { n: 10, teamCount: 2, sizes: [5, 5] },
  { n: 11, teamCount: 2, sizes: [6, 5] },
  { n: 12, teamCount: 3, sizes: [4, 4, 4] },
  { n: 13, teamCount: 3, sizes: [5, 4, 4] },
  { n: 14, teamCount: 3, sizes: [5, 5, 4] },
  { n: 15, teamCount: 3, sizes: [5, 5, 5] },
  { n: 16, teamCount: 4, sizes: [4, 4, 4, 4] },
  { n: 17, teamCount: 4, sizes: [5, 4, 4, 4] },
  { n: 18, teamCount: 4, sizes: [5, 5, 4, 4] },
  { n: 19, teamCount: 4, sizes: [5, 5, 5, 4] },
  { n: 20, teamCount: 5, sizes: [4, 4, 4, 4, 4] },
];

describe("computeTeamSizes", () => {
  for (const { n, teamCount, sizes } of SIZE_CASES) {
    it(`${n} → ${teamCount} teams ${JSON.stringify(sizes)}`, () => {
      const result = computeTeamSizes(n);
      assert.equal(result.length, teamCount);
      assert.deepEqual(result, sizes);
      assert.ok(result.every((s) => s >= 4));
      assert.equal(result.reduce((a, b) => a + b, 0), n);
    });
  }

  it("rejects fewer than 4", () => {
    assert.throws(() => computeTeamSizes(3), /at least 4/);
  });

  it("rejects more than 20", () => {
    assert.throws(() => computeTeamSizes(21), /caps at 20/);
  });
});

describe("assignTeamNames", () => {
  it("returns unique names from the locked pool", () => {
    const names = assignTeamNames(5, () => 0.1);
    assert.equal(names.length, 5);
    assert.equal(new Set(names).size, 5);
    for (const name of names) {
      assert.ok((TALK_TRACK_TEAM_NAMES as readonly string[]).includes(name));
    }
  });
});

describe("formTeams", () => {
  it("covers every participant exactly once", () => {
    const ids = Array.from({ length: 11 }, (_, i) => `p${i}`);
    const teams = formTeams(ids, () => 0.4);
    assert.equal(teams.length, 2);
    const all = teams.flatMap((t) => t.memberIds);
    assert.equal(all.length, 11);
    assert.equal(new Set(all).size, 11);
  });
});

describe("pickGuesser", () => {
  it("does not repeat until everyone has guessed", () => {
    const members = ["a", "b", "c", "d"];
    const first = pickGuesser(members, [], () => 0);
    assert.equal(first, "a");
    const second = pickGuesser(members, ["a"], () => 0);
    assert.equal(second, "b");
    const afterAll = pickGuesser(members, ["a", "b", "c", "d"], () => 0);
    assert.ok(members.includes(afterAll));
  });
});

describe("starterIndex", () => {
  it("rotates each word on a 3-person train", () => {
    assert.equal(starterIndex(1, 3), 0);
    assert.equal(starterIndex(2, 3), 1);
    assert.equal(starterIndex(3, 3), 2);
    assert.equal(starterIndex(4, 3), 0);
    assert.equal(starterIndex(5, 3), 1);
  });
});

describe("scoring", () => {
  it("slot points equal the slot index", () => {
    assert.equal(slotPoints(1), 1);
    assert.equal(slotPoints(5), 5);
    assert.equal(slotPoints(0), 0);
  });

  it("sums scored slots only", () => {
    assert.equal(
      turnPointsFromOutcomes(["scored", "scored", "passed", "expired", "unset"]),
      3
    );
  });

  it("applies nudges to the team total", () => {
    assert.equal(teamScore(6, [1, -1, 1]), 7);
  });
});

describe("clocks", () => {
  it("expires the turn at 60 seconds", () => {
    const start = "2026-01-01T00:00:00.000Z";
    const startMs = Date.parse(start);
    assert.equal(timerHasExpired(start, startMs + 59_000), false);
    assert.equal(timerHasExpired(start, startMs + 60_000), true);
  });

  it("releases hold after 5 seconds", () => {
    const start = "2026-01-01T00:00:00.000Z";
    const startMs = Date.parse(start);
    assert.equal(holdIsReady(start, startMs + 4_999), false);
    assert.equal(holdIsReady(start, startMs + 5_000), true);
  });
});

describe("liveMemberIds", () => {
  it("keeps everyone when nobody is marked connected", () => {
    assert.deepEqual(liveMemberIds(["a", "b"], { a: false, b: false }), ["a", "b"]);
  });

  it("drops disconnected members when someone is live", () => {
    assert.deepEqual(liveMemberIds(["a", "b", "c"], { a: true, b: false, c: true }), [
      "a",
      "c",
    ]);
  });
});

describe("wordsForViewer", () => {
  const words = ["SOCK", "LADDER"] as const;

  it("strips words for the live guesser", () => {
    assert.equal(wordsForViewer("g1", "g1", words), null);
  });

  it("keeps words for the train and spectators", () => {
    assert.deepEqual(wordsForViewer("t1", "g1", words), ["SOCK", "LADDER"]);
  });

  it("keeps words when there is no live guesser", () => {
    assert.deepEqual(wordsForViewer("g1", null, words), ["SOCK", "LADDER"]);
  });
});
