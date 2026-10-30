import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compareTaps,
  perspectiveSelections,
  reduceTaps,
  type ReduceableTap,
} from "./reduce-taps";
import { deriveItemState } from "./types";

function tap(
  partial: Partial<ReduceableTap> &
    Pick<ReduceableTap, "participant_id" | "item_id" | "action" | "client_seq">
): ReduceableTap {
  return {
    created_at: partial.created_at ?? "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("reduceTaps", () => {
  it("keeps two independent selection sets", () => {
    const sets = reduceTaps(
      [
        tap({ participant_id: "a", item_id: "i1", action: "select", client_seq: 1 }),
        tap({ participant_id: "b", item_id: "i1", action: "select", client_seq: 1 }),
        tap({ participant_id: "a", item_id: "i2", action: "select", client_seq: 2 }),
        tap({ participant_id: "b", item_id: "i1", action: "deselect", client_seq: 2 }),
      ],
      "a",
      "b"
    );
    assert.deepEqual(sets.selectionA, ["i1", "i2"]);
    assert.deepEqual(sets.selectionB, []);
  });

  it("tie-breaks equal timestamps by client_seq", () => {
    const sets = reduceTaps(
      [
        tap({
          participant_id: "a",
          item_id: "i1",
          action: "deselect",
          client_seq: 2,
          created_at: "2026-01-01T00:00:00.000Z",
        }),
        tap({
          participant_id: "a",
          item_id: "i1",
          action: "select",
          client_seq: 1,
          created_at: "2026-01-01T00:00:00.000Z",
        }),
      ],
      "a",
      "b"
    );
    // select (seq 1) then deselect (seq 2) → empty
    assert.deepEqual(sets.selectionA, []);
  });

  it("is deterministic when timestamp and client_seq both match across participants", () => {
    const taps = [
      tap({
        participant_id: "b",
        item_id: "i1",
        action: "select",
        client_seq: 1,
        created_at: "2026-01-01T00:00:00.000Z",
      }),
      tap({
        participant_id: "a",
        item_id: "i1",
        action: "select",
        client_seq: 1,
        created_at: "2026-01-01T00:00:00.000Z",
      }),
    ];
    const forward = reduceTaps(taps, "a", "b");
    const reverse = reduceTaps([...taps].reverse(), "a", "b");
    assert.deepEqual(forward, reverse);
    assert.equal(compareTaps(taps[0]!, taps[1]!) > 0, true);
  });

  it("ignores taps from non-members and supports solo", () => {
    const sets = reduceTaps(
      [
        tap({ participant_id: "a", item_id: "i1", action: "select", client_seq: 1 }),
        tap({ participant_id: "ghost", item_id: "i2", action: "select", client_seq: 1 }),
      ],
      "a",
      null
    );
    assert.deepEqual(sets.selectionA, ["i1"]);
    assert.deepEqual(sets.selectionB, []);
  });
});

describe("perspectiveSelections + deriveItemState", () => {
  it("flips mine/theirs for participant B", () => {
    const sets = { selectionA: ["i1"], selectionB: ["i2"] };
    const fromA = perspectiveSelections(sets, "a", "b", "a");
    const fromB = perspectiveSelections(sets, "a", "b", "b");
    assert.deepEqual(fromA.selectionMine, ["i1"]);
    assert.deepEqual(fromB.selectionMine, ["i2"]);
    assert.equal(deriveItemState("i1", fromA.selectionMine, fromA.selectionTheirs), "mine");
    assert.equal(deriveItemState("i1", fromB.selectionMine, fromB.selectionTheirs), "theirs");
    assert.equal(
      deriveItemState("i1", ["i1"], ["i1"]),
      "both"
    );
  });
});
