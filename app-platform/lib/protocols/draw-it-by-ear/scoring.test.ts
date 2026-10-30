import { test } from "node:test";
import assert from "node:assert/strict";
import { initializeGame, submitScoring, startRound } from "./engine";
import type { DibeState } from "./types";

test("all three accepted scoring tiers contribute to each drawer's 18-point total", () => {
  const participants = ["describer", "drawer-a", "drawer-b"].map(id => ({ id, display_name: id }));
  const criteria = Array.from({ length: 9 }, (_, i) => ({ text: `Criterion ${i}`, points: (Math.floor(i / 3) + 1) as 1 | 2 | 3 }));
  const catalog = ["HatMan", "Working Out"].map(name => ({ id: name, name, criteria }));
  let state: DibeState = { ...initializeGame(participants, catalog), phase: "ROUND_SCORING_1PT", current_round: 1,
    active_image_id: "HatMan", active_criteria: criteria.slice(0, 3),
    teams: [{ id: "team", name: "Team", color: "navy", member_ids: participants.map(p => p.id), describer_rotation: participants.map(p => p.id), current_describer_index: 0, cumulative_score: 0 }] };
  for (const points of [1, 2, 3]) {
    assert.equal(state.phase, `ROUND_SCORING_${points}PT`);
    const answers = Object.fromEntries(criteria.filter(c => c.points === points).map(c => [c.text, true]));
    state = submitScoring(state, "drawer-a", answers);
    state = submitScoring(state, "drawer-b", answers);
  }
  assert.equal(state.phase, "ROUND_AGGREGATE");
  assert.equal(state.participant_cumulative_scores["drawer-a"], 18);
  assert.equal(state.participant_cumulative_scores["drawer-b"], 18);
  assert.equal(state.participant_cumulative_scores.describer, 0);
  assert.equal(state.teams[0].cumulative_score, 36);
  assert.equal(Object.keys(state.round_scoring_submissions ?? {}).length, 3);
  const next = startRound({ ...state, phase: "BREAKOUT_SETUP" });
  assert.deepEqual(next.round_scoring_submissions, {});
  assert.equal(next.teams[0].cumulative_score, 36);
});
