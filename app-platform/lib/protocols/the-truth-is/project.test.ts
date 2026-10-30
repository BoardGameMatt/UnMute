import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { initializeGame } from "./engine";
import { toPlayState, toPublicPulse } from "./project";
import type { TruthIsState } from "./types";

const UNREAD = "AIRPORT CARPET COLLECTION";
const LIVE = "I once named a houseplant Kevin.";

function keysOf(value: unknown, into = new Set<string>()): Set<string> {
  if (value === null || typeof value !== "object") return into;
  if (Array.isArray(value)) {
    for (const item of value) keysOf(item, into);
    return into;
  }
  for (const [key, child] of Object.entries(value)) {
    into.add(key);
    keysOf(child, into);
  }
  return into;
}

function discussionState(): TruthIsState {
  const base = initializeGame([
    { id: "author-live", display_name: "Maya" },
    { id: "reader", display_name: "Jordan" },
    { id: "author-unread", display_name: "Sam" },
  ]);
  return {
    ...base,
    phase: "DISCUSSION",
    current_entry_id: "live",
    current_reader_id: "reader",
    current_author_id: "author-live",
    entries: [
      {
        id: "live",
        author_id: "author-live",
        text: LIVE,
        round_submitted: 1,
        used: false,
        guesses: {},
        correct_count: 0,
      },
      {
        id: "secret",
        author_id: "author-unread",
        text: UNREAD,
        round_submitted: 2,
        used: false,
        guesses: {},
        correct_count: 0,
      },
    ],
  };
}

describe("the truth is play projection", () => {
  it("hides unread text and author ids from a non-author phone", () => {
    const state = discussionState();
    const play = toPlayState(state, "reader", false);
    const pulse = toPublicPulse(state, 1);
    const playJson = JSON.stringify(play);
    const pulseJson = JSON.stringify(pulse);

    assert.equal(playJson.includes(UNREAD), false);
    assert.equal(pulseJson.includes(UNREAD), false);
    assert.equal(playJson.includes(LIVE), true);
    assert.equal(pulseJson.includes(LIVE), true);
    assert.equal(play.youAreAuthor, false);
    assert.equal(play.youAreReader, true);
    assert.equal(play.reveal, null);

    for (const keys of [keysOf(play), keysOf(pulse)]) {
      assert.equal(keys.has("author_id"), false);
      assert.equal(keys.has("authorId"), false);
      assert.equal(keys.has("current_author_id"), false);
    }
    assert.equal(pulseJson.includes("author-live"), false);
    assert.equal(pulseJson.includes("author-unread"), false);
  });

  it("tells only the reader when the line is theirs", () => {
    const state = discussionState();
    state.current_reader_id = "author-live";
    const reader = toPlayState(state, "author-live", false);
    const bystander = toPlayState(state, "author-unread", false);
    assert.equal(reader.youAreAuthor, true);
    assert.equal(bystander.youAreAuthor, false);
    assert.equal(JSON.stringify(bystander).includes(UNREAD), false);
  });

  it("names the author only at reveal", () => {
    const state = discussionState();
    state.phase = "REVEAL";
    state.votes_this_round = { reader: "author-live", "author-unread": "reader" };
    const play = toPlayState(state, "reader", false);
    assert.equal(play.reveal?.authorName, "Maya");
    assert.equal(JSON.stringify(play).includes(UNREAD), false);
    assert.equal(keysOf(play).has("author_id"), false);
  });
});
