import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeTeamSizes } from "./engine";

const CASES: { n: number; teamCount: number; sizes: number[] }[] = [
  { n: 3, teamCount: 1, sizes: [3] },
  { n: 4, teamCount: 1, sizes: [4] },
  { n: 5, teamCount: 1, sizes: [5] },
  { n: 6, teamCount: 2, sizes: [3, 3] },
  { n: 7, teamCount: 2, sizes: [4, 3] },
  { n: 8, teamCount: 2, sizes: [4, 4] },
  { n: 9, teamCount: 3, sizes: [3, 3, 3] },
  { n: 13, teamCount: 4, sizes: [4, 3, 3, 3] },
  { n: 20, teamCount: 6, sizes: [4, 4, 3, 3, 3, 3] },
];

describe("computeTeamSizes", () => {
  for (const { n, teamCount, sizes } of CASES) {
    it(`${n} participants → ${teamCount} teams ${JSON.stringify(sizes)}`, () => {
      const result = computeTeamSizes(n);
      assert.equal(result.length, teamCount);
      assert.deepEqual(result, sizes);
      assert.ok(result.every((s) => s >= 3), "no team fewer than 3");
      assert.equal(
        result.reduce((a, b) => a + b, 0),
        n,
        "sizes sum to participant count"
      );
    });
  }

  it("rejects fewer than 3 participants", () => {
    assert.throws(() => computeTeamSizes(2), /at least 3/);
    assert.throws(() => computeTeamSizes(0), /at least 3/);
  });
});
