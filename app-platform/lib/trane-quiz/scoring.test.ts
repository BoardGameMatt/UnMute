import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildParticipantPostResults,
  computeAnonymousParticipantScores,
  computeScoringSummary,
} from "./scoring";

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

describe("buildParticipantPostResults", () => {
  const questions = [
    {
      id: "q1",
      sort_order: 1,
      stem: "Which is NOT part of the framework?",
      correct_option: "c",
      options: [
        { key: "a", label: "Generating offerings" },
        { key: "b", label: "Product Strategy" },
        { key: "c", label: "Sales, Inventory, and Operations Planning" },
        { key: "d", label: "In-Line Product Management" },
      ],
    },
    {
      id: "q2",
      sort_order: 2,
      stem: "What are the 3 Cs?",
      correct_option: "c",
      options: [
        { key: "a", label: "Communication, Cooperation, Credibility" },
        { key: "b", label: "Corporate, Company, Customer" },
        { key: "c", label: "Company, Customers, Competition" },
      ],
    },
  ];

  it("returns POST percent, missed-question keys, and paired baseline", () => {
    const results = buildParticipantPostResults({
      questions,
      participantId: "p1",
      preCompleted: true,
      postUnpaired: false,
      responses: [
        { participant_id: "p1", question_id: "q1", phase: "pre", selected_option: "a" },
        { participant_id: "p1", question_id: "q2", phase: "pre", selected_option: "a" },
        { participant_id: "p1", question_id: "q1", phase: "post", selected_option: "c" },
        { participant_id: "p1", question_id: "q2", phase: "post", selected_option: "a" },
      ],
    });

    assert.equal(results.paired, true);
    assert.equal(results.postCorrect, 1);
    assert.equal(results.postPercent, 10);
    assert.equal(results.prePercent, 0);
    assert.equal(results.deltaPp, 10);
    assert.equal(results.missed.length, 1);
    assert.equal(results.missed[0]?.sortOrder, 2);
    assert.equal(
      results.missed[0]?.selectedLabel,
      "Communication, Cooperation, Credibility"
    );
    assert.equal(
      results.missed[0]?.correctLabel,
      "Company, Customers, Competition"
    );
  });

  it("omits baseline for unpaired end-only respondents", () => {
    const results = buildParticipantPostResults({
      questions,
      participantId: "p2",
      preCompleted: false,
      postUnpaired: true,
      responses: [
        { participant_id: "p2", question_id: "q1", phase: "post", selected_option: "c" },
        { participant_id: "p2", question_id: "q2", phase: "post", selected_option: "c" },
      ],
    });

    assert.equal(results.paired, false);
    assert.equal(results.prePercent, null);
    assert.equal(results.deltaPp, null);
    assert.equal(results.postPercent, 20);
    assert.equal(results.missed.length, 0);
  });
});

describe("computeAnonymousParticipantScores", () => {
  const questions = [
    { id: "q1", sort_order: 1, stem: "Q1?", correct_option: "a" },
    { id: "q2", sort_order: 2, stem: "Q2?", correct_option: "b" },
  ];

  it("labels paired, end-only, and pre-only rows without ids", () => {
    const scores = computeAnonymousParticipantScores({
      questions,
      participants: [
        {
          id: "p-end",
          pre_completed_at: null,
          post_completed_at: "t",
          post_unpaired: true,
        },
        {
          id: "p-pair",
          pre_completed_at: "t",
          post_completed_at: "t",
          post_unpaired: false,
        },
        {
          id: "p-pre",
          pre_completed_at: "t",
          post_completed_at: null,
          post_unpaired: false,
        },
        {
          id: "p-none",
          pre_completed_at: null,
          post_completed_at: null,
          post_unpaired: false,
        },
      ],
      responses: [
        { participant_id: "p-pair", question_id: "q1", phase: "pre", selected_option: "a" },
        { participant_id: "p-pair", question_id: "q2", phase: "pre", selected_option: "a" },
        { participant_id: "p-pair", question_id: "q1", phase: "post", selected_option: "a" },
        { participant_id: "p-pair", question_id: "q2", phase: "post", selected_option: "b" },
        { participant_id: "p-end", question_id: "q1", phase: "post", selected_option: "a" },
        { participant_id: "p-end", question_id: "q2", phase: "post", selected_option: "b" },
        { participant_id: "p-pre", question_id: "q1", phase: "pre", selected_option: "a" },
        { participant_id: "p-pre", question_id: "q2", phase: "pre", selected_option: "b" },
      ],
    });

    assert.equal(scores.length, 3);
    assert.deepEqual(
      scores.map((s) => s.cohort),
      ["paired", "end_only", "pre_only"]
    );
    assert.equal(scores[0]?.label, "Participant 1");
    assert.equal(scores[0]?.prePercent, 10);
    assert.equal(scores[0]?.postPercent, 20);
    assert.equal(scores[0]?.deltaPp, 10);
    assert.equal(scores[1]?.prePercent, null);
    assert.equal(scores[1]?.postPercent, 20);
    assert.equal(scores[2]?.prePercent, 20);
    assert.equal(scores[2]?.postPercent, null);
    assert.ok(scores.every((s) => !("id" in s)));
  });
});
