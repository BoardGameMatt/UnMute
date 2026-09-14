import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GUESS_SECONDS,
  WRITE_SECONDS,
  bandWeight,
  filterClues,
  guessMatches,
  isFormOfTarget,
  normalizeClue,
  pickGuesser,
  pickWord,
  rankShownStats,
  publicRevealFields,
  roundTypeLabel,
  roundTypeRule,
  timerHasExpired,
  validateClue,
} from "./engine";

describe("normalizeClue", () => {
  it("lowercases, strips hyphen and apostrophe, drops junk", () => {
    assert.equal(normalizeClue("  Ice-Cream! "), "icecream");
    assert.equal(normalizeClue("don't"), "dont");
  });
});

describe("isFormOfTarget", () => {
  it("rejects the target and obvious suffixes", () => {
    assert.equal(isFormOfTarget("run", "run"), true);
    assert.equal(isFormOfTarget("runs", "run"), true);
    assert.equal(isFormOfTarget("walked", "walk"), true);
    assert.equal(isFormOfTarget("blue", "ocean"), false);
  });
});

describe("validateClue", () => {
  it("rejects empty, multi-word, and forms of the target", () => {
    assert.equal(validateClue("  ", "PIZZA").ok, false);
    assert.equal(validateClue("hot dog", "PIZZA").ok, false);
    assert.equal(validateClue("pizzas", "PIZZA").ok, false);
    const ok = validateClue("cheese", "PIZZA");
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.normalized, "cheese");
  });
});

describe("filterClues", () => {
  it("keeps duplicates for shared and singles for unique", () => {
    const clues = ["water", "blue", "wave", "water"];
    assert.deepEqual(filterClues(clues, "shared").sort(), ["water"]);
    assert.deepEqual(filterClues(clues, "unique").sort(), ["blue", "wave"]);
  });

  it("empties the board when shared has no duplicates", () => {
    assert.deepEqual(filterClues(["deal", "middle", "agree"], "shared"), []);
  });
});

describe("guessMatches", () => {
  it("is case-insensitive after normalize", () => {
    assert.equal(guessMatches(" Ocean ", "OCEAN"), true);
    assert.equal(guessMatches("sea", "OCEAN"), false);
  });
});

describe("pickWord", () => {
  const words = [
    { id: "e1", band: "easy" as const },
    { id: "e2", band: "easy" as const },
    { id: "m1", band: "medium" as const },
    { id: "h1", band: "hard" as const },
  ];

  it("round 1 draws easy-only when any remain", () => {
    const picked = pickWord(words, 1, () => 0);
    assert.equal(picked?.band, "easy");
  });

  it("later rounds use climbing hard weight", () => {
    assert.equal(bandWeight("easy", 6), 0);
    assert.equal(bandWeight("hard", 6), 6);
    assert.equal(bandWeight("medium", 6), 3);
  });
});

describe("pickGuesser", () => {
  it("does not repeat until everyone has had a turn, then anyone may be drawn", () => {
    const ids = ["a", "b", "c"];
    const first = pickGuesser(ids, [], ids, () => 0);
    assert.equal(first, "a");
    const second = pickGuesser(ids, ["a"], ids, () => 0);
    assert.equal(second, "b");
    const afterRotation = pickGuesser(ids, ["a", "b", "c"], ids, () => 0);
    assert.equal(afterRotation, "a");
  });

  it("uses the full roster when nobody is flagged connected", () => {
    const pick = pickGuesser(["a", "b"], [], [], () => 0);
    assert.equal(pick, "a");
  });
});

describe("rankShownStats", () => {
  it("ranks by rate then count", () => {
    const ranked = rankShownStats([
      { participantId: "m", displayName: "Maya", clueRounds: 2, shownCount: 1, shownRate: 0.5 },
      { participantId: "j", displayName: "Jordan", clueRounds: 3, shownCount: 2, shownRate: 2 / 3 },
      { participantId: "s", displayName: "Steve", clueRounds: 3, shownCount: 1, shownRate: 1 / 3 },
    ]);
    assert.equal(ranked[0]?.displayName, "Jordan");
    assert.equal(ranked[1]?.displayName, "Maya");
  });
});

describe("clocks", () => {
  it("uses 30 seconds for both write and guess", () => {
    assert.equal(WRITE_SECONDS, 30);
    assert.equal(GUESS_SECONDS, 30);
  });

  it("expires after the duration", () => {
    const start = "2026-09-11T12:00:00.000Z";
    const startMs = Date.parse(start);
    assert.equal(timerHasExpired(start, startMs + 29_999, 30), false);
    assert.equal(timerHasExpired(start, startMs + 30_000, 30), true);
  });
});

describe("publicRevealFields", () => {
  it("strips the secret word when the round was abandoned", () => {
    const fields = publicRevealFields({
      phase: "reveal",
      endReason: "abandoned",
      word: "OCEAN",
      guessText: "sea",
      isHit: false,
    });
    assert.equal(fields.abandoned, true);
    assert.equal(fields.targetWord, null);
    assert.equal(fields.guessText, null);
    assert.equal(fields.isHit, null);
  });

  it("still publishes the word on a normal miss", () => {
    const fields = publicRevealFields({
      phase: "reveal",
      endReason: "timer",
      word: "OCEAN",
      guessText: null,
      isHit: false,
    });
    assert.equal(fields.abandoned, false);
    assert.equal(fields.targetWord, "OCEAN");
  });
});

describe("round type copy", () => {
  it("maps stored filters to Assemble and Disperse", () => {
    assert.equal(roundTypeLabel("shared"), "Assemble");
    assert.equal(roundTypeLabel("unique"), "Disperse");
    assert.equal(
      roundTypeRule("shared"),
      "Only clues provided by more than one participant will be shown to the guesser"
    );
    assert.equal(
      roundTypeRule("unique"),
      "Only clues which are unique among participants will be shown to the guesser"
    );
  });
});
