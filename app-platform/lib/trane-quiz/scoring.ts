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

/**
 * Headline learning delta uses the paired cohort only.
 * End-only (POST without PRE) is counted but excluded from PRE/POST/Δ.
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

  const endOnly = participants.filter(
    (p) => p.post_completed_at && (!p.pre_completed_at || p.post_unpaired)
  ).length;

  const preCompleted = participants.filter((p) => p.pre_completed_at).length;
  const postCompleted = participants.filter((p) => p.post_completed_at).length;

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

  const byQuestion: QuestionScoreRow[] = sortedQuestions.map((q) => {
    let preCorrect = 0;
    let postCorrect = 0;
    let preN = 0;
    let postN = 0;
    for (const id of Array.from(paired)) {
      const pre = responses.find(
        (r) =>
          r.participant_id === id &&
          r.question_id === q.id &&
          r.phase === "pre"
      );
      const post = responses.find(
        (r) =>
          r.participant_id === id &&
          r.question_id === q.id &&
          r.phase === "post"
      );
      if (pre) {
        preN += 1;
        if (pre.selected_option === q.correct_option) preCorrect += 1;
      }
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
