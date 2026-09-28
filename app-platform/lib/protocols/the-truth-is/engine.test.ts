import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assignReader,
  computeRoundScores,
  expireState,
  initializeGame,
  leaderFewMore,
  oneMoreRound,
  onDiscussionTimerExpired,
  processReveal,
  onSubmissionTimerExpired,
  submitEntry,
  timerDue,
} from "./engine";
import type { TruthIsEntry, TruthIsState } from "./types";

const players = [
  { id: "p1", display_name: "Maya" },
  { id: "p2", display_name: "Jordan" },
  { id: "p3", display_name: "Sam" },
];

function entry(partial: Pick<TruthIsEntry, "id" | "author_id" | "text"> & Partial<TruthIsEntry>): TruthIsEntry {
  return {
    round_submitted: 1,
    used: false,
    guesses: {},
    correct_count: 0,
    ...partial,
  };
}

describe("the truth is engine", () => {
  it("skips an empty submission and advances when the clock ends", () => {
    let state = initializeGame(players);
    state = submitEntry(state, "p1", "   ", 1);
    assert.equal(state.entries.length, 0);
    assert.equal(state.skipped_rounds.p1?.r1, true);
    assert.equal(state.phase, "SUBMISSION_1");

    state = submitEntry(state, "p2", "I can whistle", 1);
    state = onSubmissionTimerExpired(state, 1);
    assert.equal(state.phase, "SUBMISSION_2");
    assert.equal(state.entries.length, 1);
    assert.equal(state.skipped_rounds.p1?.r1, true);
    assert.equal(state.skipped_rounds.p3?.r1, true);
    assert.equal(state.timer_duration_seconds, 42);
  });

  it("opens the second prompt when everyone has finished the first", () => {
    let state = initializeGame(players);
    state = submitEntry(state, "p1", "One", 1);
    state = submitEntry(state, "p2", "Two", 1);
    state = submitEntry(state, "p3", "Three", 1);
    assert.equal(state.phase, "SUBMISSION_2");
    assert.equal(state.entries.length, 3);
  });

  it("scores an ordinary round and a bluff round", () => {
    const base = initializeGame(players);
    const ordinary: TruthIsState = {
      ...base,
      phase: "VOTING",
      current_reader_id: "p2",
      current_author_id: "p1",
      votes_this_round: { p2: "p1", p3: "p2", p1: "p3" },
    };
    const ordinaryScores = computeRoundScores(ordinary);
    assert.deepEqual(ordinaryScores.scoreDeltas, { p2: 1 });
    assert.equal(ordinaryScores.authorBluffed, false);

    const bluff: TruthIsState = {
      ...base,
      phase: "VOTING",
      current_reader_id: "p1",
      current_author_id: "p1",
      votes_this_round: { p2: "p3", p3: "p1", p1: "p2" },
    };
    const bluffScores = computeRoundScores(bluff);
    assert.equal(bluffScores.scoreDeltas.p1, 1);
    assert.equal(bluffScores.scoreDeltas.p3, 1);
    assert.equal(bluffScores.scoreDeltas.p2, undefined);
    assert.equal(bluffScores.authorBluffed, false);

    const perfect: TruthIsState = {
      ...bluff,
      votes_this_round: { p2: "p3", p3: "p2" },
    };
    const perfectScores = computeRoundScores(perfect);
    assert.equal(perfectScores.authorBluffed, true);
    assert.equal(perfectScores.scoreDeltas.p1, 3);
  });

  it("lets the previous author read their own next entry", () => {
    const base = initializeGame(players);
    const state: TruthIsState = {
      ...base,
      phase: "READING_ASSIGNMENT",
      total_rounds_played: 1,
      next_reader_from_previous_author_id: "p1",
      play_order: ["e1"],
      entries: [entry({ id: "e1", author_id: "p1", text: "This one is mine" })],
    };
    const next = assignReader(state);
    assert.equal(next.phase, "DISCUSSION");
    assert.equal(next.current_reader_id, "p1");
    assert.equal(next.current_author_id, "p1");
    assert.equal(next.timer_duration_seconds, 180);
    const voting = onDiscussionTimerExpired(next);
    assert.equal(voting.phase, "VOTING");
    assert.equal(voting.timer_duration_seconds, 60);
  });

  it("pauses after the third round until the facilitator continues", () => {
    const base = initializeGame(players);
    const state: TruthIsState = {
      ...base,
      phase: "REVEAL",
      total_rounds_played: 2,
      current_entry_id: "e1",
      current_reader_id: "p2",
      current_author_id: "p1",
      entries: [
        entry({ id: "e1", author_id: "p1", text: "Just read" }),
        entry({ id: "e2", author_id: "p2", text: "Still waiting" }),
        entry({ id: "e3", author_id: "p3", text: "Also waiting" }),
      ],
      play_order: ["e1", "e2", "e3"],
      votes_this_round: { p2: "p1" },
    };
    const paused = processReveal(state);
    assert.equal(paused.phase, "WRAP_UP");
    assert.equal(paused.total_rounds_played, 3);
    assert.equal(paused.entries.find((row) => row.id === "e1")?.used, true);
    assert.equal(paused.entries.find((row) => row.id === "e2")?.used, false);

    const again = oneMoreRound(paused);
    assert.equal(again.phase, "DISCUSSION");
    assert.equal(again.current_entry_id, "e2");

    const pausedAgain = processReveal({
      ...again,
      phase: "REVEAL",
      votes_this_round: { p1: "p2" },
    });
    assert.equal(pausedAgain.phase, "WRAP_UP");
    assert.equal(pausedAgain.total_rounds_played, 4);
    assert.equal(pausedAgain.entries.find((row) => row.id === "e3")?.used, false);
  });

  it("adds a few more rounds from the unused pool", () => {
    const base = initializeGame(players);
    const state: TruthIsState = {
      ...base,
      phase: "WRAP_UP",
      total_rounds_played: 3,
      minimum_rounds: 3,
      progress_total_rounds: 3,
      next_reader_from_previous_author_id: "p1",
      entries: [entry({ id: "e1", author_id: "p2", text: "Still unread aloud" })],
    };
    const next = leaderFewMore(state);
    assert.equal(next.phase, "DISCUSSION");
    assert.equal(next.lead_chose_continue, true);
    assert.equal(next.current_entry_id, "e1");
    assert.ok(next.progress_total_rounds > 3);
  });

  it("does not advance a clock that is still running", () => {
    const state = initializeGame(players);
    const start = Date.parse(state.timer_started_at ?? "");
    assert.equal(timerDue(state.timer_started_at, state.timer_duration_seconds, start + 1_000), false);
    assert.equal(expireState(state, start + 1_000), state);

    const expired = expireState(state, start + 42_000);
    assert.equal(expired.phase, "SUBMISSION_2");
    assert.notEqual(expired, state);
  });
});
