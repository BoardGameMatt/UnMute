import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { TraneReportDocument } from "./report-document";
import type { TraneReportPayload } from "./report-data";

const payload: TraneReportPayload = {
  courseTitle: "PGT Foundations",
  courseSlug: "pgt-foundations",
  classDate: "2026-09-18",
  label: "Pilot",
  generatedAt: "2026-09-18T12:00:00.000Z",
  summary: {
    joined: 3,
    preCompleted: 2,
    postCompleted: 2,
    paired: 1,
    endOnly: 1,
    meanPrePercent: 40,
    meanPostPercent: 80,
    deltaPp: 40,
    byQuestion: [
      {
        questionId: "q1",
        sortOrder: 1,
        stem: "Which of the following is NOT a part of the framework?",
        prePercent: 50,
        postPercent: 100,
        deltaPp: 50,
      },
    ],
  },
  participantScores: [
    {
      label: "Participant 1",
      cohort: "paired",
      prePercent: 40,
      postPercent: 80,
      deltaPp: 40,
    },
    {
      label: "Participant 2",
      cohort: "end_only",
      prePercent: null,
      postPercent: 70,
      deltaPp: null,
    },
    {
      label: "Participant 3",
      cohort: "pre_only",
      prePercent: 30,
      postPercent: null,
      deltaPp: null,
    },
  ],
};

describe("TraneReportDocument", () => {
  it("renders a two-page PDF for a mixed cohort", async () => {
    const buffer = await renderToBuffer(
      React.createElement(TraneReportDocument, { payload, logoSrc: "" })
    );
    assert.ok(buffer.byteLength > 1000);
    const text = buffer.toString("latin1");
    assert.match(text, /%PDF/);
    assert.match(text, /\/Count 2/);
  });
});
