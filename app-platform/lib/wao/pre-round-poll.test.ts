import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyPlayLoadStatus,
  initialPreRoundPollState,
  nextPreRoundPollIntervalMs,
  PRE_ROUND_POLL_BASE_MS,
  PRE_ROUND_POLL_CAP_MS,
  PRE_ROUND_STILL_TRYING_AFTER,
  reducePreRoundPoll,
  shouldPollPreRound,
} from "./pre-round-poll";

describe("classifyPlayLoadStatus", () => {
  it("treats 404 as not_found", () => {
    assert.equal(classifyPlayLoadStatus(404), "not_found");
  });

  it("treats 403 as terminal", () => {
    assert.equal(classifyPlayLoadStatus(403), "terminal");
  });

  it("treats 5xx as transient", () => {
    assert.equal(classifyPlayLoadStatus(500), "transient");
    assert.equal(classifyPlayLoadStatus(503), "transient");
  });
});

describe("nextPreRoundPollIntervalMs", () => {
  it("starts at the base interval", () => {
    assert.equal(nextPreRoundPollIntervalMs(0), PRE_ROUND_POLL_BASE_MS);
  });

  it("widens with consecutive failures and caps near 10s", () => {
    assert.equal(nextPreRoundPollIntervalMs(1), 6000);
    assert.equal(nextPreRoundPollIntervalMs(2), 9000);
    assert.equal(nextPreRoundPollIntervalMs(3), PRE_ROUND_POLL_CAP_MS);
    assert.equal(nextPreRoundPollIntervalMs(8), PRE_ROUND_POLL_CAP_MS);
  });
});

describe("reducePreRoundPoll", () => {
  it("keeps polling after a transient failure then reaches success", () => {
    let state = initialPreRoundPollState();
    assert.equal(shouldPollPreRound(state), true);

    state = reducePreRoundPoll(state, { type: "transient" });
    assert.equal(shouldPollPreRound(state), true);
    assert.equal(state.hasEverLoaded, false);
    assert.ok(state.pollIntervalMs > PRE_ROUND_POLL_BASE_MS);

    state = reducePreRoundPoll(state, { type: "success" });
    assert.equal(state.hasEverLoaded, true);
    assert.equal(shouldPollPreRound(state), false);
    assert.equal(state.pollIntervalMs, PRE_ROUND_POLL_BASE_MS);
    assert.equal(state.consecutiveFailures, 0);
  });

  it("widens the interval across consecutive failures and keeps polling", () => {
    let state = initialPreRoundPollState();
    const intervals: number[] = [];

    for (let i = 0; i < 4; i += 1) {
      state = reducePreRoundPoll(state, { type: "transient" });
      intervals.push(state.pollIntervalMs);
      assert.equal(shouldPollPreRound(state), true);
    }

    assert.deepEqual(intervals, [6000, 9000, 10000, 10000]);
    assert.equal(state.showStillTrying, true);
    assert.ok(state.consecutiveFailures >= PRE_ROUND_STILL_TRYING_AFTER);
  });

  it("stops polling on 403 / terminal", () => {
    let state = initialPreRoundPollState();
    state = reducePreRoundPoll(state, { type: "transient" });
    assert.equal(shouldPollPreRound(state), true);

    state = reducePreRoundPoll(state, { type: "terminal" });
    assert.equal(state.terminal, true);
    assert.equal(shouldPollPreRound(state), false);
  });

  it("resets backoff on not_found (still waiting for a round)", () => {
    let state = initialPreRoundPollState();
    state = reducePreRoundPoll(state, { type: "transient" });
    state = reducePreRoundPoll(state, { type: "transient" });
    assert.ok(state.pollIntervalMs > PRE_ROUND_POLL_BASE_MS);

    state = reducePreRoundPoll(state, { type: "not_found" });
    assert.equal(shouldPollPreRound(state), true);
    assert.equal(state.pollIntervalMs, PRE_ROUND_POLL_BASE_MS);
    assert.equal(state.consecutiveFailures, 0);
    assert.equal(state.showStillTrying, false);
  });
});

describe("mocked fetch → poll state (pre-round load cycle)", () => {
  async function applyMockedFetch(
    state: ReturnType<typeof initialPreRoundPollState>,
    fetchImpl: () => Promise<Response>
  ) {
    try {
      const res = await fetchImpl();
      if (res.ok) {
        return reducePreRoundPoll(state, { type: "success" });
      }
      const kind = classifyPlayLoadStatus(res.status);
      if (kind === "not_found") return reducePreRoundPoll(state, { type: "not_found" });
      if (kind === "terminal") return reducePreRoundPoll(state, { type: "terminal" });
      return reducePreRoundPoll(state, { type: "transient" });
    } catch {
      return reducePreRoundPoll(state, { type: "transient" });
    }
  }

  it("transient then success reaches loaded without needing a remount flag reset", async () => {
    let state = initialPreRoundPollState();

    state = await applyMockedFetch(
      state,
      async () => new Response(JSON.stringify({ error: "boom" }), { status: 500 })
    );
    assert.equal(shouldPollPreRound(state), true);
    assert.equal(state.hasEverLoaded, false);

    state = await applyMockedFetch(
      state,
      async () =>
        new Response(JSON.stringify({ pairId: "p1", startedAt: "2026-01-01" }), {
          status: 200,
        })
    );
    assert.equal(state.hasEverLoaded, true);
    assert.equal(shouldPollPreRound(state), false);
  });

  it("network throw is transient and keeps the interval alive", async () => {
    let state = initialPreRoundPollState();
    state = await applyMockedFetch(state, async () => {
      throw new TypeError("Failed to fetch");
    });
    assert.equal(shouldPollPreRound(state), true);
    assert.equal(state.consecutiveFailures, 1);
    assert.ok(state.pollIntervalMs > PRE_ROUND_POLL_BASE_MS);
  });

  it("403 stops polling", async () => {
    let state = initialPreRoundPollState();
    state = await applyMockedFetch(
      state,
      async () => new Response(JSON.stringify({ error: "forbidden" }), { status: 403 })
    );
    assert.equal(shouldPollPreRound(state), false);
    assert.equal(state.terminal, true);
  });
});
