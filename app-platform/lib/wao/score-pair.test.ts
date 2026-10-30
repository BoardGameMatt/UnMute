import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRevealBuckets,
  eliminationCurveScore,
  scoreEliminationSet,
  scorePair,
} from "./score-pair";

describe("eliminationCurveScore", () => {
  it("returns 0 for non-positive counts", () => {
    assert.equal(eliminationCurveScore(0), 0);
    assert.equal(eliminationCurveScore(-1), 0);
  });

  it("hits each triangular step through 5", () => {
    assert.deepEqual(
      [1, 2, 3, 4, 5].map(eliminationCurveScore),
      [1, 3, 6, 10, 15]
    );
  });

  it("adds +5 for each step past 5", () => {
    assert.deepEqual(
      [6, 7, 8, 9].map(eliminationCurveScore),
      [20, 25, 30, 35]
    );
  });
});

describe("scoreEliminationSet — zero rule", () => {
  const correct = new Set(["c1", "c2"]);

  it("scores zero when any submitted item is correct", () => {
    assert.equal(scoreEliminationSet(["w1", "c1"], correct), 0);
    assert.equal(scoreEliminationSet(["c2"], correct), 0);
  });

  it("scores the curve when every submitted item is wrong", () => {
    assert.equal(scoreEliminationSet(["w1", "w2", "w3"], correct), 6);
  });
});

describe("scorePair", () => {
  const correct = ["c1", "c2"];
  const paired = {
    isSolo: false as const,
    correctItemIds: correct,
    participantA: "alice",
    participantB: "bob",
  };

  it("uses intersection as the submitted set for a real pair", () => {
    const out = scorePair({
      selectionA: ["w1", "w2", "c1"],
      selectionB: ["w1", "w2", "w3"],
      ...paired,
    });
    assert.deepEqual(out.submittedItemIds, ["w1", "w2"]);
    assert.equal(out.score, 3);
    assert.equal(out.bonus, 0);
  });

  it("zeros the round when the intersection includes a correct item", () => {
    const out = scorePair({
      selectionA: ["w1", "c1"],
      selectionB: ["w1", "c1", "w2"],
      ...paired,
    });
    assert.deepEqual(out.submittedItemIds, ["c1", "w1"]);
    assert.equal(out.score, 0);
  });

  it("halves solo scores with floor", () => {
    // solo submits 4 wrong → raw 10 → floor(10/2)=5
    const out = scorePair({
      selectionA: ["w1", "w2", "w3", "w4"],
      selectionB: [],
      isSolo: true,
      correctItemIds: correct,
    });
    assert.deepEqual(out.submittedItemIds, ["w1", "w2", "w3", "w4"]);
    assert.equal(out.score, 5);
    assert.equal(out.lott, 0);
    assert.equal(out.hadSave, false);
    assert.equal(out.saverParticipantId, null);
    assert.equal(out.exactMatch, false);
  });

  it("floors odd solo halves", () => {
    // 1 wrong → raw 1 → floor(0.5)=0
    const out = scorePair({
      selectionA: ["w1"],
      selectionB: [],
      isSolo: true,
      correctItemIds: correct,
    });
    assert.equal(out.score, 0);
  });

  it("computes LOTT from solo_wrong union", () => {
    // both: w1,w2 → score 3
    // A alone wrong: w3; B alone wrong: w4 → lott_set 4 wrong → 10
    // LOTT = 10 - 3 = 7
    const out = scorePair({
      selectionA: ["w1", "w2", "w3"],
      selectionB: ["w1", "w2", "w4"],
      ...paired,
    });
    assert.equal(out.score, 3);
    assert.equal(out.lott, 7);
    assert.equal(out.hadSave, false);
    assert.equal(out.saverParticipantId, null);
  });

  it("LOTT is 0 when solo_wrong would not improve a zeroed submitted set", () => {
    // both include c1 → submitted scores 0; lott_set still has c1 → 0; LOTT 0
    const out = scorePair({
      selectionA: ["c1", "w1"],
      selectionB: ["c1", "w2"],
      ...paired,
    });
    assert.equal(out.score, 0);
    assert.equal(out.lott, 0);
  });

  it("names the partner who declined a correct item as saver", () => {
    // A tapped c1 alone; B declined → B saved the round
    const out = scorePair({
      selectionA: ["w1", "c1"],
      selectionB: ["w1"],
      ...paired,
    });
    assert.equal(out.score, 1);
    assert.equal(out.hadSave, true);
    assert.equal(out.saverParticipantId, "bob");
  });

  it("shows no save when neither partner alone tapped a correct item", () => {
    const out = scorePair({
      selectionA: ["w1", "w2", "w3"],
      selectionB: ["w1", "w2", "w4"],
      ...paired,
    });
    assert.equal(out.score, 3);
    assert.equal(out.hadSave, false);
    assert.equal(out.saverParticipantId, null);
  });

  it("attributes save to A when B alone tapped a correct item", () => {
    const out = scorePair({
      selectionA: ["w1", "w2"],
      selectionB: ["w1", "c1"],
      ...paired,
    });
    assert.equal(out.saverParticipantId, "alice");
    assert.equal(out.hadSave, true);
  });

  it("never produces a save on a solo round", () => {
    const out = scorePair({
      selectionA: ["w1", "c1"],
      selectionB: [],
      isSolo: true,
      correctItemIds: correct,
    });
    assert.equal(out.saverParticipantId, null);
    assert.equal(out.hadSave, false);
  });

  it("exact_match when full selection sets are identical", () => {
    const match = scorePair({
      selectionA: ["w1", "w2"],
      selectionB: ["w2", "w1"],
      ...paired,
    });
    assert.equal(match.exactMatch, true);

    const miss = scorePair({
      selectionA: ["w1", "w2"],
      selectionB: ["w1"],
      ...paired,
    });
    assert.equal(miss.exactMatch, false);
  });

  it("exact_match is false for solo", () => {
    const out = scorePair({
      selectionA: ["w1"],
      selectionB: [],
      isSolo: true,
      correctItemIds: correct,
    });
    assert.equal(out.exactMatch, false);
  });
});

/**
 * Reveal payloads must name the same saver for both viewers.
 * Mirrors build-reveal-state resolution without I/O.
 */
function revealSaveFields(
  saverParticipantId: string | null,
  viewerId: string,
  names: Record<string, string>
): { saverDisplayName: string | null; viewerIsSaver: boolean } {
  if (saverParticipantId === null) {
    return { saverDisplayName: null, viewerIsSaver: false };
  }
  return {
    saverDisplayName: names[saverParticipantId] ?? "Player",
    viewerIsSaver: saverParticipantId === viewerId,
  };
}

describe("Save reveal attribution (both viewers)", () => {
  const names = { alice: "Alice", bob: "Bob" };

  it("names B as saver in both viewers' payloads when A alone tapped correct", () => {
    const scored = scorePair({
      selectionA: ["w1", "w2", "w3", "w4", "w5", "c1"],
      selectionB: ["w1", "w2", "w3", "w4", "w5"],
      isSolo: false,
      correctItemIds: ["c1"],
      participantA: "alice",
      participantB: "bob",
    });
    assert.equal(scored.score, 15);
    assert.equal(scored.saverParticipantId, "bob");

    const forAlice = revealSaveFields(scored.saverParticipantId, "alice", names);
    const forBob = revealSaveFields(scored.saverParticipantId, "bob", names);

    assert.equal(forAlice.saverDisplayName, "Bob");
    assert.equal(forBob.saverDisplayName, "Bob");
    assert.equal(forAlice.viewerIsSaver, false);
    assert.equal(forBob.viewerIsSaver, true);
  });

  it("shows no saver name when nobody alone tapped a correct item", () => {
    const scored = scorePair({
      selectionA: ["w1", "w2"],
      selectionB: ["w1", "w2"],
      isSolo: false,
      correctItemIds: ["c1"],
      participantA: "alice",
      participantB: "bob",
    });
    assert.equal(scored.saverParticipantId, null);
    const forAlice = revealSaveFields(scored.saverParticipantId, "alice", names);
    assert.equal(forAlice.saverDisplayName, null);
  });
});

describe("buildRevealBuckets", () => {
  const items = [
    { id: "w1", label: "Wrong 1", isCorrect: false },
    { id: "w2", label: "Wrong 2", isCorrect: false },
    { id: "c1", label: "Correct 1", isCorrect: true },
    { id: "w3", label: "Wrong 3", isCorrect: false },
  ];

  it("orders the four buckets from the viewer perspective", () => {
    const buckets = buildRevealBuckets({
      selectionMine: ["w1", "c1", "w3"],
      selectionTheirs: ["w1", "c1", "w2"],
      isSolo: false,
      items,
    });
    assert.deepEqual(
      buckets.bothCorrectElimination.map((i) => i.id),
      ["w1"]
    );
    assert.deepEqual(
      buckets.bothButBelonged.map((i) => i.id),
      ["c1"]
    );
    assert.deepEqual(
      buckets.onlyYouRight.map((i) => i.id),
      ["w3"]
    );
    assert.deepEqual(
      buckets.onlyPartnerRight.map((i) => i.id),
      ["w2"]
    );
  });
});
