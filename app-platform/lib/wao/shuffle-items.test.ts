import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shuffleItemsForPair } from "./shuffle-items";

const ITEMS = [
  { id: "a", label: "Alpha" },
  { id: "b", label: "Bravo" },
  { id: "c", label: "Charlie" },
  { id: "d", label: "Delta" },
  { id: "e", label: "Echo" },
];

describe("shuffleItemsForPair", () => {
  it("produces the same order for the same pairId", () => {
    const first = shuffleItemsForPair(ITEMS, "pair-aaa");
    const second = shuffleItemsForPair(ITEMS, "pair-aaa");
    assert.deepEqual(
      first.map((i) => i.id),
      second.map((i) => i.id)
    );
  });

  it("produces different orders for different pairIds", () => {
    const a = shuffleItemsForPair(ITEMS, "pair-aaa").map((i) => i.id);
    const b = shuffleItemsForPair(ITEMS, "pair-bbb").map((i) => i.id);
    assert.notDeepEqual(a, b);
  });

  it("returns a permutation of the input ids", () => {
    const out = shuffleItemsForPair(ITEMS, "pair-aaa");
    assert.equal(out.length, ITEMS.length);
    const ids = out.map((i) => i.id);
    assert.deepEqual([...ids].sort(), [...ITEMS.map((i) => i.id)].sort());
    assert.equal(new Set(ids).size, ids.length);
  });

  it("does not mutate the input array", () => {
    const copy = ITEMS.map((i) => ({ ...i }));
    const before = copy.map((i) => i.id);
    shuffleItemsForPair(copy, "pair-aaa");
    assert.deepEqual(
      copy.map((i) => i.id),
      before
    );
  });

  it("is stable when input arrives in a different order", () => {
    const reversed = [...ITEMS].reverse();
    const fromOriginal = shuffleItemsForPair(ITEMS, "pair-aaa").map((i) => i.id);
    const fromReversed = shuffleItemsForPair(reversed, "pair-aaa").map(
      (i) => i.id
    );
    assert.deepEqual(fromOriginal, fromReversed);
  });
});
