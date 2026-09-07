import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildRevealOrder, isAllowedGifUrl, timerHasExpired } from "./engine";

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
});
