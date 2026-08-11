import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeScoringSummary } from "./scoring";

describe("computeScoringSummary", () => {
  const questions = [
    { id: "q1", sort_order: 1, stem: "Q1?", correct_option: "a" },
    { id: "q2", sort_order: 2, stem: "Q2?", correct_option: "b" },
  ];

  it("computes paired means and excludes end-only from delta", () => {
    const participants = [
      {
        id: "p1",
        pre_completed_at: "t",
        post_completed_at: "t",
        post_unpaired: false,
      },
      {
        id: "p2",
        pre_completed_at: null,
        post_completed_at: "t",
        post_unpaired: true,
      },
    ];
    const responses = [
      { participant_id: "p1", question_id: "q1", phase: "pre" as const, selected_option: "a" },
      { participant_id: "p1", question_id: "q2", phase: "pre" as const, selected_option: "a" },
      { participant_id: "p1", question_id: "q1", phase: "post" as const, selected_option: "a" },
      { participant_id: "p1", question_id: "q2", phase: "post" as const, selected_option: "b" },
      { participant_id: "p2", question_id: "q1", phase: "post" as const, selected_option: "a" },
      { participant_id: "p2", question_id: "q2", phase: "post" as const, selected_option: "b" },
    ];

    const summary = computeScoringSummary({ participants, responses, questions });
    assert.equal(summary.joined, 2);
    assert.equal(summary.paired, 1);
    assert.equal(summary.endOnly, 1);
    assert.equal(summary.preCompleted, 1);
    assert.equal(summary.postCompleted, 2);
    // p1: pre 1/2 = 50, post 2/2 = 100 — but QUESTIONS_PER_COURSE is 10
    // so scores are correct/10 * 100
    assert.equal(summary.meanPrePercent, 10); // 1/10 * 100
    assert.equal(summary.meanPostPercent, 20); // 2/10 * 100
    assert.equal(summary.deltaPp, 10);
    assert.equal(summary.byQuestion[0]?.prePercent, 100);
    assert.equal(summary.byQuestion[0]?.postPercent, 100);
    assert.equal(summary.byQuestion[1]?.prePercent, 0);
    assert.equal(summary.byQuestion[1]?.postPercent, 100);
  });

  it("fills per-question % from phase completers when no paired cohort", () => {
    const participants = [
      {
        id: "p1",
        pre_completed_at: "t",
        post_completed_at: null,
        post_unpaired: false,
      },
      {
        id: "p2",
        pre_completed_at: null,
        post_completed_at: "t",
        post_unpaired: true,
      },
    ];
    const responses = [
      { participant_id: "p1", question_id: "q1", phase: "pre" as const, selected_option: "a" },
      { participant_id: "p1", question_id: "q2", phase: "pre" as const, selected_option: "b" },
      { participant_id: "p2", question_id: "q1", phase: "post" as const, selected_option: "a" },
      { participant_id: "p2", question_id: "q2", phase: "post" as const, selected_option: "a" },
    ];
    const summary = computeScoringSummary({ participants, responses, questions });
    assert.equal(summary.paired, 0);
    assert.equal(summary.joined, 2);
    assert.equal(summary.byQuestion[0]?.prePercent, 100);
    assert.equal(summary.byQuestion[0]?.postPercent, 100);
    assert.equal(summary.byQuestion[1]?.prePercent, 100);
    assert.equal(summary.byQuestion[1]?.postPercent, 0);
  });
});
