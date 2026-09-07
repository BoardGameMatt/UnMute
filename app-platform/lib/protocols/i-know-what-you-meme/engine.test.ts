import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildRevealOrder, isAllowedGifUrl, pickTwoUnique, timerHasExpired } from "./engine";

describe("ikwym engine", () => {
  it("orders reveal as shuffled round 1 then shuffled round 2", () => {
    const items = [
      { id: "a", round: 1 as const },
      { id: "b", round: 1 as const },
      { id: "c", round: 2 as const },
      { id: "d", round: 2 as const },
    ];
    let n = 0;
    const random = () => {
      n += 1;
      return n % 2 === 0 ? 0.9 : 0.1;
    };
    const order = buildRevealOrder(items, random);
    assert.deepEqual(
      order.map((row) => row.round),
      [1, 1, 2, 2]
    );
    assert.equal(order.length, 4);
  });

  it("accepts Giphy CDN urls only", () => {
    assert.equal(isAllowedGifUrl("https://media.giphy.com/media/abc/giphy.gif"), true);
    assert.equal(isAllowedGifUrl("https://evil.example/x.gif"), false);
    assert.equal(isAllowedGifUrl("http://media.giphy.com/media/abc/giphy.gif"), false);
  });

  it("expires the guess clock from a server timestamp", () => {
    const start = "2026-09-07T12:00:00.000Z";
    const startMs = Date.parse(start);
    assert.equal(timerHasExpired(start, startMs + 29_000, 30), false);
    assert.equal(timerHasExpired(start, startMs + 30_000, 30), true);
  });

  it("draws two unused prompts at random without repeating", () => {
    const items = ["a", "b", "c", "d", "e"].map((id) => ({ id }));
    const identityLike = () => 0.999;
    const reversedLike = () => 0;
    const firstTwo = pickTwoUnique(items, identityLike);
    const otherTwo = pickTwoUnique(items, reversedLike);
    assert.ok(firstTwo);
    assert.ok(otherTwo);
    assert.notEqual(firstTwo[0].id, firstTwo[1].id);
    assert.notEqual(otherTwo[0].id, otherTwo[1].id);
    assert.deepEqual(
      firstTwo.map((row) => row.id),
      ["a", "b"]
    );
    assert.notDeepEqual(
      otherTwo.map((row) => row.id),
      ["a", "b"]
    );
  });
});
