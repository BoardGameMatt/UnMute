import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  drawQuestion,
  mayDrawInactiveQuestions,
  type DrawCandidate,
} from "./draw-question";

const library: DrawCandidate[] = [
  { id: "a1", pinned: false, active: false, difficulty: 2 },
  { id: "a2", pinned: false, active: false, difficulty: 3 },
  { id: "p1", pinned: true, active: false, difficulty: 4 },
  { id: "live", pinned: false, active: true, difficulty: 1 },
];

describe("mayDrawInactiveQuestions", () => {
  it("never allows inactive without the explicit flag", () => {
    assert.equal(mayDrawInactiveQuestions(false, "development"), false);
  });

  it("allows the flag only outside production", () => {
    assert.equal(mayDrawInactiveQuestions(true, "development"), true);
    assert.equal(mayDrawInactiveQuestions(true, "production"), false);
  });
});

describe("drawQuestion", () => {
  it("respects active-only when includeInactive is false", () => {
    const drawn = drawQuestion(library, new Set(), {
      includeInactive: false,
      nodeEnv: "development",
      random: () => 0,
    });
    assert.ok(drawn);
    assert.equal(drawn!.id, "live");
  });

  it("forces unused pinned into the draw when inactive is allowed", () => {
    const drawn = drawQuestion(library, new Set(["live"]), {
      includeInactive: true,
      nodeEnv: "development",
      random: () => 0,
    });
    assert.ok(drawn);
    assert.equal(drawn!.id, "p1");
  });

  it("skips used questions and prefers ascending difficulty", () => {
    const drawn = drawQuestion(
      [
        { id: "d1", pinned: false, active: false, difficulty: 1 },
        { id: "d3", pinned: false, active: false, difficulty: 3 },
        { id: "d5", pinned: false, active: false, difficulty: 5 },
      ],
      new Set(["d1"]),
      {
        includeInactive: true,
        nodeEnv: "development",
        priorDifficulties: [1],
        random: () => 0,
      }
    );
    assert.ok(drawn);
    assert.equal(drawn!.id, "d3");
  });

  it("returns null when the pool is exhausted", () => {
    const drawn = drawQuestion(library, new Set(["live"]), {
      includeInactive: false,
      nodeEnv: "development",
      random: () => 0,
    });
    assert.equal(drawn, null);
  });

  it("ignores includeInactive in production", () => {
    const drawn = drawQuestion(library, new Set(["live"]), {
      includeInactive: true,
      nodeEnv: "production",
      random: () => 0,
    });
    assert.equal(drawn, null);
  });
});
