import type { TraneResponsePhase } from "@/lib/types/database";
import { QUESTIONS_PER_COURSE } from "./constants";

export type ScoringParticipant = {
  id: string;
  pre_completed_at: string | null;
  post_completed_at: string | null;
  post_unpaired: boolean;
};

export type ScoringResponse = {
  participant_id: string;
  question_id: string;
  phase: TraneResponsePhase;
  selected_option: string;
};

export type ScoringQuestion = {
  id: string;
  sort_order: number;
  stem: string;
  correct_option: string;
  options?: { key: string; label: string }[];
};

export type ParticipantScoreCohort = "paired" | "end_only" | "pre_only";

export type AnonymousParticipantScore = {
  label: string;
  cohort: ParticipantScoreCohort;
  prePercent: number | null;
  postPercent: number | null;
  deltaPp: number | null;
};

export type MissedQuestionReview = {
  sortOrder: number;
  stem: string;
  selectedLabel: string;
  correctLabel: string;
};

export type TranePostResultsPayload = {
  postPercent: number;
  postCorrect: number;
  total: number;
  paired: boolean;
  prePercent: number | null;
  deltaPp: number | null;
  missed: MissedQuestionReview[];
};

export type QuestionScoreRow = {
  questionId: string;
  sortOrder: number;
  stem: string;
  prePercent: number | null;
  postPercent: number | null;
  deltaPp: number | null;
};

export type ScoringSummary = {
  joined: number;
  preCompleted: number;
  postCompleted: number;
  paired: number;
  endOnly: number;
  meanPrePercent: number | null;
  meanPostPercent: number | null;
  deltaPp: number | null;
  byQuestion: QuestionScoreRow[];
};

function pct(correct: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((correct / total) * 1000) / 10;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

export function percentCorrect(correct: number): number {
  return Math.round((correct / QUESTIONS_PER_COURSE) * 1000) / 10;
}

function optionLabel(question: ScoringQuestion, key: string): string {
  const found = question.options?.find((o) => o.key === key);
  return found?.label ?? key;
}

export function countCorrectForPhase(input: {
  responses: ScoringResponse[];
  questions: ScoringQuestion[];
  participantId: string;
  phase: TraneResponsePhase;
}): number {
  const byId = new Map(input.questions.map((q) => [q.id, q]));
  let n = 0;
  for (const r of input.responses) {
    if (r.participant_id !== input.participantId || r.phase !== input.phase) {
      continue;
    }
    const q = byId.get(r.question_id);
    if (q && r.selected_option === q.correct_option) n += 1;
  }
  return n;
}

export function missedQuestionsForPhase(input: {
  questions: ScoringQuestion[];
  responses: ScoringResponse[];
  participantId: string;
  phase: TraneResponsePhase;
}): MissedQuestionReview[] {
  const sorted = [...input.questions].sort(
    (a, b) => a.sort_order - b.sort_order
  );
  const selected = new Map<string, string>();
  for (const r of input.responses) {
    if (
      r.participant_id === input.participantId &&
      r.phase === input.phase
    ) {
      selected.set(r.question_id, r.selected_option);
    }
  }

  const missed: MissedQuestionReview[] = [];
  for (const q of sorted) {
    const sel = selected.get(q.id);
    if (sel === q.correct_option) continue;
    missed.push({
      sortOrder: q.sort_order,
      stem: q.stem,
      selectedLabel: sel ? optionLabel(q, sel) : "No answer",
      correctLabel: optionLabel(q, q.correct_option),
    });
  }
  return missed;
}

/**
 * End-of-class results for the respondent. Answer keys are only for
 * questions they missed on POST — never sent during PRE or while answering.
 */
export function buildParticipantPostResults(input: {
  questions: ScoringQuestion[];
  responses: ScoringResponse[];
  participantId: string;
  preCompleted: boolean;
  postUnpaired: boolean;
}): TranePostResultsPayload {
  const postCorrect = countCorrectForPhase({
    ...input,
    phase: "post",
  });
  const postPercent = percentCorrect(postCorrect);
  const paired = input.preCompleted && !input.postUnpaired;
  let prePercent: number | null = null;
  let deltaPp: number | null = null;
  if (paired) {
    const preCorrect = countCorrectForPhase({
      ...input,
      phase: "pre",
    });
    prePercent = percentCorrect(preCorrect);
    deltaPp = Math.round((postPercent - prePercent) * 10) / 10;
  }

  return {
    postPercent,
    postCorrect,
    total: QUESTIONS_PER_COURSE,
    paired,
    prePercent,
    deltaPp,
    missed: missedQuestionsForPhase({
      questions: input.questions,
      responses: input.responses,
      participantId: input.participantId,
      phase: "post",
    }),
  };
}

function cohortForParticipant(
  p: ScoringParticipant
): ParticipantScoreCohort | null {
  const hasPre = !!p.pre_completed_at;
  const hasPost = !!p.post_completed_at;
  if (hasPost && hasPre && !p.post_unpaired) return "paired";
  if (hasPost) return "end_only";
  if (hasPre) return "pre_only";
  return null;
}

const COHORT_ORDER: Record<ParticipantScoreCohort, number> = {
  paired: 0,
  end_only: 1,
  pre_only: 2,
};

/**
 * Anonymous per-person scores for the PDF. Labels only — no tokens or ids.
 * Paired rows include beginning, end, and change. Single-phase rows leave
 * the missing side blank.
 */
export function computeAnonymousParticipantScores(input: {
  participants: ScoringParticipant[];
  responses: ScoringResponse[];
  questions: ScoringQuestion[];
}): AnonymousParticipantScore[] {
  const rows: Array<AnonymousParticipantScore & { id: string }> = [];

  for (const p of input.participants) {
    const cohort = cohortForParticipant(p);
    if (!cohort) continue;

    const preCorrect = countCorrectForPhase({
      responses: input.responses,
      questions: input.questions,
      participantId: p.id,
      phase: "pre",
    });
    const postCorrect = countCorrectForPhase({
      responses: input.responses,
      questions: input.questions,
      participantId: p.id,
      phase: "post",
    });

    const prePercent = cohort === "end_only" ? null : percentCorrect(preCorrect);
    const postPercent = cohort === "pre_only" ? null : percentCorrect(postCorrect);
    const deltaPp =
      prePercent !== null && postPercent !== null
        ? Math.round((postPercent - prePercent) * 10) / 10
        : null;

    rows.push({
      id: p.id,
      label: "",
      cohort,
      prePercent,
      postPercent,
      deltaPp,
    });
  }

  rows.sort((a, b) => {
    const cohortDiff = COHORT_ORDER[a.cohort] - COHORT_ORDER[b.cohort];
    if (cohortDiff !== 0) return cohortDiff;
    return a.id.localeCompare(b.id);
  });

  return rows.map((row, index) => ({
    label: `Participant ${index + 1}`,
    cohort: row.cohort,
    prePercent: row.prePercent,
    postPercent: row.postPercent,
    deltaPp: row.deltaPp,
  }));
}

/**
 * Headline learning delta uses the paired cohort only.
 * End-only (POST without PRE) is counted but excluded from PRE/POST/Δ.
 *
 * Per-question % when paired is empty: fall back to all PRE completers /
 * all POST completers so the table is not blank when someone finished only
 * one phase.
 */
export function computeScoringSummary(input: {
  participants: ScoringParticipant[];
  responses: ScoringResponse[];
  questions: ScoringQuestion[];
}): ScoringSummary {
  const { participants, responses, questions } = input;
  const sortedQuestions = [...questions].sort(
    (a, b) => a.sort_order - b.sort_order
  );

  const paired = new Set(
    participants
      .filter((p) => p.pre_completed_at && p.post_completed_at && !p.post_unpaired)
      .map((p) => p.id)
  );

  const preCompleters = new Set(
    participants.filter((p) => p.pre_completed_at).map((p) => p.id)
  );
  const postCompleters = new Set(
    participants.filter((p) => p.post_completed_at).map((p) => p.id)
  );

  const endOnly = participants.filter(
    (p) => p.post_completed_at && (!p.pre_completed_at || p.post_unpaired)
  ).length;

  const preCompleted = preCompleters.size;
  const postCompleted = postCompleters.size;

  const correctByParticipantPhase = new Map<string, number>();
  for (const r of responses) {
    if (!paired.has(r.participant_id)) continue;
    const q = sortedQuestions.find((x) => x.id === r.question_id);
    if (!q) continue;
    if (r.selected_option === q.correct_option) {
      const key = `${r.participant_id}:${r.phase}`;
      correctByParticipantPhase.set(
        key,
        (correctByParticipantPhase.get(key) ?? 0) + 1
      );
    }
  }

  const preScores: number[] = [];
  const postScores: number[] = [];
  for (const id of Array.from(paired)) {
    const preCorrect = correctByParticipantPhase.get(`${id}:pre`) ?? 0;
    const postCorrect = correctByParticipantPhase.get(`${id}:post`) ?? 0;
    preScores.push((preCorrect / QUESTIONS_PER_COURSE) * 100);
    postScores.push((postCorrect / QUESTIONS_PER_COURSE) * 100);
  }

  const meanPrePercent = mean(preScores);
  const meanPostPercent = mean(postScores);
  const deltaPp =
    meanPrePercent !== null && meanPostPercent !== null
      ? Math.round((meanPostPercent - meanPrePercent) * 10) / 10
      : null;

  const preCohort = paired.size > 0 ? paired : preCompleters;
  const postCohort = paired.size > 0 ? paired : postCompleters;

  const byQuestion: QuestionScoreRow[] = sortedQuestions.map((q) => {
    let preCorrect = 0;
    let postCorrect = 0;
    let preN = 0;
    let postN = 0;
    for (const id of Array.from(preCohort)) {
      const pre = responses.find(
        (r) =>
          r.participant_id === id &&
          r.question_id === q.id &&
          r.phase === "pre"
      );
      if (pre) {
        preN += 1;
        if (pre.selected_option === q.correct_option) preCorrect += 1;
      }
    }
    for (const id of Array.from(postCohort)) {
      const post = responses.find(
        (r) =>
          r.participant_id === id &&
          r.question_id === q.id &&
          r.phase === "post"
      );
      if (post) {
        postN += 1;
        if (post.selected_option === q.correct_option) postCorrect += 1;
      }
    }
    const prePercent = pct(preCorrect, preN);
    const postPercent = pct(postCorrect, postN);
    const delta =
      prePercent !== null && postPercent !== null
        ? Math.round((postPercent - prePercent) * 10) / 10
        : null;
    return {
      questionId: q.id,
      sortOrder: q.sort_order,
      stem: q.stem,
      prePercent,
      postPercent,
      deltaPp: delta,
    };
  });

  return {
    joined: participants.length,
    preCompleted,
    postCompleted,
    paired: paired.size,
    endOnly,
    meanPrePercent,
    meanPostPercent,
    deltaPp,
    byQuestion,
  };
}
