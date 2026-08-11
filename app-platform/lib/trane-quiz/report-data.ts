import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  TraneCourse,
  TraneOffering,
  TraneParticipant,
  TraneQuestion,
  TraneQuestionOption,
  TraneResponse,
} from "@/lib/types/database";
import { computeScoringSummary, type ScoringSummary } from "./scoring";

export type TraneReportPayload = {
  courseTitle: string;
  courseSlug: string;
  classDate: string;
  label: string | null;
  generatedAt: string;
  summary: ScoringSummary;
};

function parseOptions(raw: unknown): TraneQuestionOption[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (o): o is TraneQuestionOption =>
      !!o &&
      typeof o === "object" &&
      typeof (o as TraneQuestionOption).key === "string" &&
      typeof (o as TraneQuestionOption).label === "string"
  );
}

export async function buildReportPayload(
  admin: SupabaseClient,
  offering: TraneOffering
): Promise<TraneReportPayload | { error: string }> {
  const { data: course, error: cErr } = await admin
    .from("trane_courses")
    .select("*")
    .eq("id", offering.course_id)
    .maybeSingle();

  if (cErr || !course) {
    return { error: "Course not found" };
  }

  const { data: questions, error: qErr } = await admin
    .from("trane_questions")
    .select("*")
    .eq("course_id", offering.course_id)
    .order("sort_order", { ascending: true });

  if (qErr || !questions) {
    return { error: "Questions not found" };
  }

  const { data: participants, error: pErr } = await admin
    .from("trane_participants")
    .select("*")
    .eq("offering_id", offering.id);

  if (pErr || !participants) {
    return { error: "Participants not found" };
  }

  const { data: responses, error: rErr } = await admin
    .from("trane_responses")
    .select("*")
    .eq("offering_id", offering.id);

  if (rErr || !responses) {
    return { error: "Responses not found" };
  }

  const courseRow = course as TraneCourse;
  const questionRows = (questions as TraneQuestion[]).map((q) => ({
    ...q,
    options: parseOptions(q.options),
  }));

  const summary = computeScoringSummary({
    participants: participants as TraneParticipant[],
    responses: responses as TraneResponse[],
    questions: questionRows.map((q) => ({
      id: q.id,
      sort_order: q.sort_order,
      stem: q.stem,
      correct_option: q.correct_option,
    })),
  });

  return {
    courseTitle: courseRow.title,
    courseSlug: courseRow.slug,
    classDate: offering.class_date,
    label: offering.label,
    generatedAt: new Date().toISOString(),
    summary,
  };
}
