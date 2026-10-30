import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assignTeamIdentities, buildAutoTeams } from "./engine";
import type { DibeParticipant } from "./types";

function participants(n: number): DibeParticipant[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    display_name: `Player ${i + 1}`,
  }));
}

describe("assignTeamIdentities", () => {
  for (const teamCount of [2, 4, 6] as const) {
    it(`${teamCount} teams all get unique names`, () => {
      // Several formation events — uniqueness must hold every time.
      for (let trial = 0; trial < 20; trial++) {
        const identities = assignTeamIdentities(teamCount);
        assert.equal(identities.length, teamCount);
        const names = identities.map((id) => id.name);
        assert.equal(new Set(names).size, names.length, names.join(", "));
      }
    });
  }

  it("overflow beyond the 9-name pool still yields unique labels", () => {
    const identities = assignTeamIdentities(12);
    assert.equal(identities.length, 12);
    const names = identities.map((id) => id.name);
    assert.equal(new Set(names).size, 12);
    assert.ok(names.includes("Team 1"));
    assert.ok(names.includes("Team 3"));
  });
});

describe("buildAutoTeams name uniqueness", () => {
  // floor(n/3) teams: 6→2, 12→4, 18→6
  for (const { n, teamCount } of [
    { n: 6, teamCount: 2 },
    { n: 12, teamCount: 4 },
    { n: 18, teamCount: 6 },
  ] as const) {
    it(`${n} participants (${teamCount} teams) have unique names`, () => {
      const teams = buildAutoTeams(participants(n));
      assert.equal(teams.length, teamCount);
      const names = teams.map((t) => t.name);
      assert.equal(new Set(names).size, names.length, names.join(", "));
    });
  }
});
