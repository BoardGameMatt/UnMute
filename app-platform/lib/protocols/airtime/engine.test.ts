import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TREASURE_DECK, cardById } from "./config";
import {
  airToSurface,
  allUnderwaterHaveChosen,
  assignBoats,
  boatCountFor,
  boatDiveTotal,
  canChoose,
  gaugeBand,
  marginFor,
  newDive,
  rankBoats,
  resolveTurn,
  rivalDiveScore,
  roundTripAir,
  seededRandom,
  tankFor,
  timerHasExpired,
  turnGraceHasExpired,
} from "./engine";
import type { Choice, DiveState, TurnResult } from "./types";

/** Each diver dives to `targets[i]` then swims back up every turn. */
function planChoices(state: DiveState, targets: Record<string, number>): Record<string, Choice> {
  const choices: Record<string, Choice> = {};
  for (const d of state.divers) {
    if (d.status !== "underwater") continue;
    const target = targets[d.participantId] ?? 1;
    choices[d.participantId] = d.depth === d.deepest && d.deepest < target ? "deeper" : "up";
  }
  return choices;
}

function runPlan(targets: number[], seed = "seed"): { state: DiveState; results: TurnResult[] } {
  const ids = targets.map((_, i) => `d${i}`);
  let state = newDive([{ boatId: "b1", memberIds: ids }], seededRandom(seed));
  const byId = Object.fromEntries(ids.map((id, i) => [id, targets[i] ?? 1]));
  const results: TurnResult[] = [];
  for (let guard = 0; guard < 20; guard++) {
    const result = resolveTurn(state, planChoices(state, byId));
    results.push(result);
    state = result.state;
    if (result.ended) break;
  }
  return { state, results };
}

describe("boats", () => {
  it("sizes boats by headcount, at most 4 per boat, balanced within 1", () => {
    const expected: Record<number, number> = { 2: 1, 3: 1, 4: 2, 5: 2, 8: 2, 9: 3, 12: 3, 13: 4, 16: 4 };
    for (let n = 2; n <= 16; n++) {
      const ids = Array.from({ length: n }, (_, i) => `p${i}`);
      const boats = assignBoats(ids, seededRandom(`n${n}`));
      if (expected[n] !== undefined) assert.equal(boats.length, expected[n], `boats at ${n}`);
      assert.equal(boats.length, boatCountFor(n));
      const sizes = boats.map((b) => b.length);
      assert.ok(Math.max(...sizes) <= 4, `max size at ${n}`);
      assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `balance at ${n}`);
      assert.deepEqual(boats.flat().sort(), [...ids].sort());
    }
  });

  it("tank is 4 per diver plus 11", () => {
    assert.deepEqual([2, 3, 4].map((s) => tankFor(s)), [19, 23, 27]);
  });

  it("The Orca scores 10–13 per dive, averaging 11.5", () => {
    assert.equal(rivalDiveScore(() => 0), 10);
    assert.equal(rivalDiveScore(() => 0.999999), 13);
    const rng = seededRandom("belafonte");
    const draws = Array.from({ length: 4000 }, () => rivalDiveScore(rng));
    assert.ok(draws.every((d) => d >= 10 && d <= 13));
    assert.deepEqual(Array.from(new Set(draws)).sort(), [10, 11, 12, 13]);
    const mean = draws.reduce((s, d) => s + d, 0) / draws.length;
    assert.ok(Math.abs(mean - 11.5) < 0.1, `mean ${mean}`);
  });
});

describe("air", () => {
  it("air to surface from each depth", () => {
    assert.deepEqual([1, 2, 3, 4, 5, 6].map((d) => airToSurface(d)), [0, 1, 2, 3, 5, 7]);
  });

  it("round trip cost to each depth", () => {
    assert.deepEqual([1, 2, 3, 4, 5, 6].map((d) => roundTripAir(d)), [0, 2, 4, 7, 11, 16]);
  });

  it("gauge bands by percent of starting tank", () => {
    assert.equal(gaugeBand(23, 23), "plenty");
    assert.equal(gaugeBand(13, 23), "half");
    assert.equal(gaugeBand(6, 23), "low");
    assert.equal(gaugeBand(3, 23), "critical");
    assert.equal(gaugeBand(0, 23), "critical");
  });
});

describe("worked example (boat of 3, tank 23)", () => {
  it("1 / 4 / 6 uses all 23 air and loses nobody", () => {
    const { state, results } = runPlan([1, 4, 6]);
    const last = results[results.length - 1];
    assert.equal(last?.endReason, "all_back");
    assert.equal(state.boats[0]?.tank, 0);
    assert.ok(state.divers.every((d) => d.status === "surfaced"));
    assert.deepEqual(
      state.divers.map((d) => d.deepest),
      [1, 4, 6]
    );
  });

  it("one more level anywhere runs the tank dry", () => {
    const { state } = runPlan([1, 5, 6]);
    assert.ok(state.divers.some((d) => d.status === "lost"));
    assert.equal(state.boats[0]?.tank, 0);
  });

  it("everyone to level 6 runs dry", () => {
    const { state } = runPlan([6, 6, 6]);
    assert.ok(state.divers.every((d) => d.status === "lost"));
  });

  it("haul is the deepest card's value and boat total sums hauls", () => {
    const { state } = runPlan([1, 4, 6]);
    for (const d of state.divers) {
      const c = cardById(d.itemId);
      assert.equal(c?.level, d.deepest);
      assert.equal(d.haul, c?.value);
    }
    assert.equal(
      boatDiveTotal(state, "b1"),
      state.divers.reduce((s, d) => s + d.haul, 0)
    );
  });
});

describe("resolution order", () => {
  it("surfacing resolves before air drain", () => {
    const state = newDive([{ boatId: "b1", memberIds: ["up", "deep"] }], seededRandom("x"));
    const deep = state.divers.find((d) => d.participantId === "deep");
    if (!deep) throw new Error("missing diver");
    deep.depth = 5;
    deep.deepest = 5;
    const boat = state.boats[0];
    if (!boat) throw new Error("missing boat");
    boat.tank = 1;
    const result = resolveTurn(state, { up: "up", deep: "deeper" });
    const up = result.state.divers.find((d) => d.participantId === "up");
    assert.equal(up?.status, "surfaced");
    assert.equal(result.state.divers.find((d) => d.participantId === "deep")?.status, "lost");
  });

  it("a tank at exactly 0 is not out of air", () => {
    const state = newDive([{ boatId: "b1", memberIds: ["a"] }], seededRandom("y"));
    const a = state.divers[0];
    const boat = state.boats[0];
    if (!a || !boat) throw new Error("missing");
    a.depth = 2;
    a.deepest = 2;
    boat.tank = 1;
    const t1 = resolveTurn(state, { a: "up" });
    assert.equal(t1.state.boats[0]?.tank, 0);
    assert.equal(t1.state.divers[0]?.status, "underwater");
    const t2 = resolveTurn(t1.state, { a: "up" });
    assert.equal(t2.state.divers[0]?.status, "surfaced");
    assert.equal(t2.endReason, "all_back");
  });

  it("Dive Deeper at depth 6 is refused and resolves as swim back up", () => {
    const state = newDive([{ boatId: "b1", memberIds: ["a"] }], seededRandom("z"));
    const a = state.divers[0];
    if (!a) throw new Error("missing");
    a.depth = 6;
    a.deepest = 6;
    assert.equal(canChoose(a, "deeper"), false);
    assert.equal(canChoose(a, "up"), true);
    const result = resolveTurn(state, { a: "deeper" });
    assert.equal(result.state.divers[0]?.depth, 5);
  });

  it("a missing choice swims back up and is marked timed out", () => {
    const state = newDive([{ boatId: "b1", memberIds: ["a", "b"] }], seededRandom("t"));
    assert.equal(allUnderwaterHaveChosen(state, { a: "deeper" }), false);
    const result = resolveTurn(state, { a: "deeper" });
    const b = result.state.divers.find((d) => d.participantId === "b");
    assert.equal(b?.status, "surfaced");
    const ev = result.events.find(
      (e) => e.type === "choice" && e.payload.participant_id === "b"
    );
    assert.ok(ev && ev.type === "choice" && ev.payload.timed_out && ev.payload.choice === "up");
  });

  it("End dive after this turn forfeits anyone still underwater", () => {
    const state = newDive([{ boatId: "b1", memberIds: ["a", "b"] }], seededRandom("f"));
    const result = resolveTurn(state, { a: "deeper", b: "up" }, { endAfterThisTurn: true });
    assert.equal(result.endReason, "facilitator");
    assert.equal(result.state.divers.find((d) => d.participantId === "a")?.status, "forfeit");
    assert.equal(result.state.divers.find((d) => d.participantId === "a")?.haul, 0);
    assert.equal(result.state.divers.find((d) => d.participantId === "b")?.status, "surfaced");
  });

  it("the 14-turn cap forfeits divers still down", () => {
    let state = newDive([{ boatId: "b1", memberIds: ["a"] }], seededRandom("cap"));
    const boat = state.boats[0];
    if (!boat) throw new Error("missing");
    boat.tank = 999;
    let result: TurnResult | null = null;
    for (let i = 0; i < 14; i++) {
      const a = state.divers[0];
      const choice: Choice = a && a.depth >= 6 ? "up" : a && a.depth <= 2 ? "deeper" : "deeper";
      result = resolveTurn(state, { a: choice });
      state = result.state;
      if (result.ended) break;
    }
    assert.equal(result?.endReason, "max_turns");
    assert.equal(state.divers[0]?.status, "forfeit");
  });

  it("margin goes negative once the boat can't bring everyone back", () => {
    const divers = [
      { depth: 6, status: "underwater" as const },
      { depth: 4, status: "underwater" as const },
    ];
    assert.equal(marginFor(10, divers), 0);
    assert.equal(marginFor(9, divers), -1);
  });
});

describe("decks", () => {
  it("no two divers on a boat hold the same card in a dive", () => {
    for (let s = 0; s < 200; s++) {
      const { state } = runPlan([6, 6, 6, 6], `deck${s}`);
      const ids = state.divers.map((d) => d.itemId);
      assert.equal(new Set(ids).size, ids.length);
    }
  });

  it("every level has at least 5 cards and 36 in total", () => {
    assert.equal(TREASURE_DECK.length, 36);
    for (let level = 1; level <= 6; level++) {
      assert.ok(TREASURE_DECK.filter((c) => c.level === level).length >= 5);
    }
  });
});

describe("scoring", () => {
  it("ties share the win", () => {
    const { ranked, winnerIds } = rankBoats([
      { boatId: "a", diveTotals: [10], total: 10 },
      { boatId: "b", diveTotals: [12], total: 12 },
      { boatId: "c", diveTotals: [12], total: 12 },
    ]);
    assert.equal(ranked[0]?.total, 12);
    assert.deepEqual(winnerIds.sort(), ["b", "c"]);
  });

  it("timer expiry", () => {
    assert.equal(timerHasExpired(null, Date.now()), false);
    assert.equal(timerHasExpired(new Date(1000).toISOString(), 999), false);
    assert.equal(timerHasExpired(new Date(1000).toISOString(), 1000), true);
  });

  it("turn resolves only after the late-choice grace", () => {
    const ends = new Date(10_000).toISOString();
    assert.equal(turnGraceHasExpired(ends, 10_000), false);
    assert.equal(turnGraceHasExpired(ends, 13_999), false);
    assert.equal(turnGraceHasExpired(ends, 14_000), true);
    assert.equal(turnGraceHasExpired(null, 99_999), false);
  });
});
