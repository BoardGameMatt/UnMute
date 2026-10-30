import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyRailOrder,
  canWrap,
  dealNumbers,
  insertDealAt,
  isExactOrder,
  isSharedScreenName,
  kCapped,
  kForRound,
  mayExposeNamedTiles,
  maySeeDealtNumber,
  percentInOrder,
  pickClueGivers,
  pickSubject,
  placeInSlot,
  progressRatio,
  swapSlots,
  teamRowShowsNumbers,
  timerHasExpired,
  validateClue,
} from "./engine";
import type { RankTile } from "./types";

describe("kForRound", () => {
  it("uses 3 / 4 / 6 / 8 then 8", () => {
    assert.equal(kForRound(1), 3);
    assert.equal(kForRound(2), 4);
    assert.equal(kForRound(3), 6);
    assert.equal(kForRound(4), 8);
    assert.equal(kForRound(5), 8);
    assert.equal(kForRound(9), 8);
  });

  it("caps at n", () => {
    assert.equal(kCapped(4, 3), 3);
    assert.equal(kCapped(1, 20), 3);
  });
});

describe("validateClue", () => {
  it("accepts a plain example", () => {
    const result = validateClue("  gas station burrito  ");
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.text, "gas station burrito");
  });

  it("accepts qualifiers and adjectives without counts", () => {
    const result = validateClue("the leftover gas-station burrito that somehow still slaps");
    assert.equal(result.ok, true);
  });

  it("rejects empty, digits, money, percent, and over-length", () => {
    assert.equal(validateClue("   ").ok, false);
    assert.equal(validateClue("99 muffins").ok, false);
    assert.equal(validateClue("$8 burrito").ok, false);
    assert.equal(validateClue("top 1%").ok, false);
    assert.equal(validateClue("a".repeat(250)).ok, true);
    assert.equal(validateClue("a".repeat(251)).ok, false);
  });
});

describe("pickClueGivers", () => {
  it("fills the lowest turn-count bucket first", () => {
    const picked = pickClueGivers(
      ["a", "b", "c", "d"],
      { a: 2, b: 0, c: 0, d: 1 },
      2,
      () => 0
    );
    assert.deepEqual(picked.sort(), ["b", "c"]);
  });

  it("never leaves someone two turns ahead when filling k", () => {
    const picked = pickClueGivers(
      ["a", "b", "c"],
      { a: 1, b: 1, c: 0 },
      2,
      () => 0
    );
    assert.ok(picked.includes("c"));
    assert.equal(picked.length, 2);
  });
});

describe("pickSubject", () => {
  const pack = [
    { id: "ex", category: "example" as const },
    { id: "g1", category: "general_calibration" as const },
    { id: "t1", category: "team_behaviors" as const },
  ];

  it("round 1 is the example card", () => {
    const picked = pickSubject(pack, 1, () => 0);
    assert.equal(picked?.id, "ex");
  });

  it("rounds 2-4 prefer general calibration", () => {
    const unused = pack.filter((row) => row.category !== "example");
    const picked = pickSubject(unused, 2, () => 0);
    assert.equal(picked?.category, "general_calibration");
  });

  it("round 5 prefers team behaviors", () => {
    const unused = pack.filter((row) => row.category !== "example");
    const picked = pickSubject(unused, 5, () => 0);
    assert.equal(picked?.category, "team_behaviors");
  });

  it("spills to the other deck when the preferred deck is empty", () => {
    const onlyTeam = [{ id: "t1", category: "team_behaviors" as const }];
    const picked = pickSubject(onlyTeam, 2, () => 0);
    assert.equal(picked?.id, "t1");
  });

  it("round 6+ prefers team or general by the 50/50 coin", () => {
    const unused = pack.filter((row) => row.category !== "example");
    assert.equal(pickSubject(unused, 6, () => 0)?.category, "team_behaviors");
    assert.equal(pickSubject(unused, 6, () => 0.9)?.category, "general_calibration");
  });

  it("returns null when the pack is starved", () => {
    assert.equal(pickSubject([], 6), null);
  });
});

describe("visibility", () => {
  it("strips dealt_number for spectators, display, and post-write phases", () => {
    assert.equal(
      maySeeDealtNumber({ phase: "write", isDisplay: false, isClueGiver: true }),
      true
    );
    assert.equal(
      maySeeDealtNumber({ phase: "write", isDisplay: true, isClueGiver: true }),
      false
    );
    assert.equal(
      maySeeDealtNumber({ phase: "write", isDisplay: false, isClueGiver: false }),
      false
    );
    assert.equal(
      maySeeDealtNumber({ phase: "rank", isDisplay: false, isClueGiver: true }),
      false
    );
  });

  it("holds named tiles until rank and numbers on the team row until a hit", () => {
    assert.equal(mayExposeNamedTiles("write"), false);
    assert.equal(mayExposeNamedTiles("rank"), true);
    assert.equal(teamRowShowsNumbers("reveal", false), false);
    assert.equal(teamRowShowsNumbers("reveal", true), true);
  });
});

describe("dealNumbers", () => {
  it("deals unique values from 1-99", () => {
    const nums = dealNumbers(8, () => 0.3);
    assert.equal(nums.length, 8);
    assert.equal(new Set(nums).size, 8);
    assert.ok(nums.every((n) => n >= 1 && n <= 99));
  });

  it("uses 8, 48, and 92 on round 1", () => {
    const nums = dealNumbers(3, () => 0, 1);
    assert.deepEqual([...nums].sort((a, b) => a - b), [8, 48, 92]);
  });
});

describe("scoring helpers", () => {
  it("scores exact increasing order only", () => {
    assert.equal(isExactOrder([12, 41, 88]), true);
    assert.equal(isExactOrder([12, 88, 41]), false);
    assert.equal(isExactOrder([]), false);
    assert.equal(isExactOrder([7]), true);
  });

  it("computes percent and wrap gates", () => {
    assert.equal(percentInOrder(2, 5), 40);
    assert.equal(percentInOrder(0, 0), 0);
    assert.equal(canWrap(4, 10), false);
    assert.equal(canWrap(5, 10), true);
    assert.equal(canWrap(2, 0), true);
    assert.equal(progressRatio(5), 1);
    assert.equal(progressRatio(2), 0.4);
  });

  it("inserts a deal onto the rail without duplicating", () => {
    assert.deepEqual(insertDealAt(["a", "b"], "c", 1), ["a", "c", "b"]);
    assert.deepEqual(insertDealAt(["a", "c", "b"], "c", 0), ["c", "a", "b"]);
  });

  it("places into empty slots and swaps neighbors", () => {
    assert.deepEqual(placeInSlot([null, null, null], "a", 1), [null, "a", null]);
    assert.deepEqual(placeInSlot([null, "a", null], "a", 0), ["a", null, null]);
    assert.deepEqual(swapSlots(["a", "b", null], 0, 1), ["b", "a", null]);
  });

  it("moves a tray card onto the rail without waiting for a round trip", () => {
    const tray: RankTile[] = [
      { dealId: "a", clueText: "snoring", displayName: "Maya", dealtNumber: null },
      { dealId: "b", clueText: "bathroom", displayName: "Priya", dealtNumber: null },
    ];
    const next = applyRailOrder([null, null], tray, ["a", null]);
    assert.equal(next.rail[0]?.dealId, "a");
    assert.deepEqual(
      next.tray.map((tile) => tile.dealId),
      ["b"]
    );
  });

  it("returns a placed card to the remaining tray order", () => {
    const a: RankTile = { dealId: "a", clueText: "a", displayName: "Maya", dealtNumber: null };
    const b: RankTile = { dealId: "b", clueText: "b", displayName: "Priya", dealtNumber: null };
    const next = applyRailOrder([a, null], [b], [null, null]);
    assert.deepEqual(
      next.rail.map((tile) => tile?.dealId ?? null),
      [null, null]
    );
    assert.deepEqual(
      next.tray.map((tile) => tile.dealId),
      ["b", "a"]
    );
  });

  it("expires from a start timestamp", () => {
    const start = new Date("2026-09-20T12:00:00.000Z").getTime();
    assert.equal(timerHasExpired("2026-09-20T12:00:00.000Z", start + 59_000, 60), false);
    assert.equal(timerHasExpired("2026-09-20T12:00:00.000Z", start + 60_000, 60), true);
  });
});

describe("shared screen sentinel", () => {
  it("matches Shared screen regardless of case", () => {
    assert.equal(isSharedScreenName("Shared screen"), true);
    assert.equal(isSharedScreenName(" shared screen "), true);
    assert.equal(isSharedScreenName("Maya"), false);
  });
});
