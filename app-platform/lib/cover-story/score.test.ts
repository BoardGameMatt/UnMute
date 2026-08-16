import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lastPlantDate } from "./format";
import { normalizeGuess, suggestCorrect } from "./match-guess";
import {
  fisherYates,
  missionScore,
  pickDisjointHands,
  pickHand,
  type1Score,
  type2Score,
} from "./score";

describe("lastPlantDate", () => {
  it("is the calendar day before reveal", () => {
    assert.equal(lastPlantDate("2026-09-10"), "2026-09-09");
    assert.equal(lastPlantDate("2026-03-01"), "2026-02-28");
    assert.equal(lastPlantDate(null), undefined);
  });
});

describe("normalizeGuess", () => {
  it("folds case, punctuation, and extra space", () => {
    assert.equal(normalizeGuess("  The Office!  "), "the office");
    assert.equal(normalizeGuess("Dunder-Mifflin"), "dunder mifflin");
  });
});

describe("suggestCorrect", () => {
  it("matches official name and aliases", () => {
    assert.equal(suggestCorrect("green vegetables", "Green Vegetables", ["veggies"]), true);
    assert.equal(suggestCorrect("veggies", "Green Vegetables", ["veggies"]), true);
    assert.equal(suggestCorrect("fruit", "Green Vegetables", ["veggies"]), false);
  });
});

describe("type1Score", () => {
  it("zeros the ends and peaks near half for seven guessers", () => {
    assert.deepEqual(
      [0, 1, 2, 3, 4, 5, 6, 7].map((k) => type1Score(k, 7)),
      [0, 6, 10, 12, 12, 10, 6, 0]
    );
  });
});

describe("type2Score", () => {
  it("pays more when fewer people are right", () => {
    assert.equal(type2Score(1, 10), 9);
    assert.equal(type2Score(5, 10), 5);
    assert.equal(type2Score(10, 10), 0);
    assert.equal(type2Score(0, 10), 0);
  });
});

describe("missionScore", () => {
  it("is all-or-nothing 15", () => {
    assert.equal(missionScore(true), 15);
    assert.equal(missionScore(false), 0);
  });
});

describe("pickHand", () => {
  it("draws unique ids and burns from a shuffled copy", () => {
    const hand = pickHand([1, 2, 3, 4, 5], 3, () => 0);
    assert.equal(hand.length, 3);
    assert.equal(new Set(hand).size, 3);
  });

  it("throws when the pool is too small", () => {
    assert.throws(() => pickHand([1, 2], 3), /Not enough/);
  });
});

describe("pickDisjointHands", () => {
  it("gives each player a unique hand with no shared agencies", () => {
    const hands = pickDisjointHands([1, 2, 3, 4, 5, 6, 7, 8, 9], 3, 3, () => 0);
    assert.equal(hands.length, 3);
    const flat = hands.flat();
    assert.equal(flat.length, 9);
    assert.equal(new Set(flat).size, 9);
  });

  it("throws when the pool cannot cover every hand", () => {
    assert.throws(() => pickDisjointHands([1, 2, 3, 4, 5], 2, 3), /Not enough/);
  });
});

describe("fisherYates", () => {
  it("does not mutate the input", () => {
    const input = [1, 2, 3];
    fisherYates(input, () => 0);
    assert.deepEqual(input, [1, 2, 3]);
  });
});
