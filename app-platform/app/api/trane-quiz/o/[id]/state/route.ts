import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireParticipant } from "@/lib/trane-quiz/auth";
import { TRANE_QUIZ_PARTICIPANT_COOKIE } from "@/lib/trane-quiz/constants";
import { responsePhaseForOffering } from "@/lib/trane-quiz/phases";
import { buildParticipantPostResults } from "@/lib/trane-quiz/scoring";
import type {
  TraneQuestion,
  TraneQuestionOption,
  TraneResponse,
} from "@/lib/types/database";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

/** Participant-facing state. Answer keys are included only after POST completes, and only for missed questions. */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const participantId = cookies().get(TRANE_QUIZ_PARTICIPANT_COOKIE)?.value;
  const auth = await requireParticipant(params.id, participantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { offering, participant, admin } = auth;
  const activePhase = responsePhaseForOffering(offering.phase);

  const { data: course } = await admin
    .from("trane_courses")
    .select("title, slug")
    .eq("id", offering.course_id)
    .maybeSingle();

  const { data: questions, error: qErr } = await admin
    .from("trane_questions")
    .select("id, sort_order, stem, options, correct_option")
    .eq("course_id", offering.course_id)
    .order("sort_order", { ascending: true });

  if (qErr || !questions) {
    return NextResponse.json(
      { error: "Could not load questions" },
      { status: 500 }
    );
  }

  const qRows = questions as Pick<
    TraneQuestion,
    "id" | "sort_order" | "stem" | "options" | "correct_option"
  >[];

  let answeredKeys: string[] = [];
  let currentQuestionIndex = 0;
  let needsUnpairedConfirm = false;
  let phaseDone = false;

  if (activePhase === "pre") {
    phaseDone = !!participant.pre_completed_at;
    const { data: responses } = await admin
      .from("trane_responses")
      .select("question_id")
      .eq("offering_id", offering.id)
      .eq("participant_id", participant.id)
      .eq("phase", "pre");
    answeredKeys = ((responses ?? []) as Pick<TraneResponse, "question_id">[]).map(
      (r) => r.question_id
    );
  } else if (activePhase === "post") {
    phaseDone = !!participant.post_completed_at;
    if (!participant.pre_completed_at && !participant.post_unpaired_confirmed_at) {
      needsUnpairedConfirm = true;
    }
    const { data: responses } = await admin
      .from("trane_responses")
      .select("question_id")
      .eq("offering_id", offering.id)
      .eq("participant_id", participant.id)
      .eq("phase", "post");
    answeredKeys = ((responses ?? []) as Pick<TraneResponse, "question_id">[]).map(
      (r) => r.question_id
    );
  }

  const answered = new Set(answeredKeys);
  currentQuestionIndex = qRows.findIndex((q) => !answered.has(q.id));
  if (currentQuestionIndex < 0) currentQuestionIndex = qRows.length;

  const publicQuestions = qRows.map((q) => ({
    id: q.id,
    sortOrder: q.sort_order,
    stem: q.stem,
    options: parseOptions(q.options),
  }));

  let results = null;
  if (participant.post_completed_at) {
    const { data: scoredResponses } = await admin
      .from("trane_responses")
      .select("participant_id, question_id, phase, selected_option")
      .eq("offering_id", offering.id)
      .eq("participant_id", participant.id);

    results = buildParticipantPostResults({
      questions: qRows.map((q) => ({
        id: q.id,
        sort_order: q.sort_order,
        stem: q.stem,
        correct_option: q.correct_option,
        options: parseOptions(q.options),
      })),
      responses: (scoredResponses ?? []) as Pick<
        TraneResponse,
        "participant_id" | "question_id" | "phase" | "selected_option"
      >[],
      participantId: participant.id,
      preCompleted: !!participant.pre_completed_at,
      postUnpaired: participant.post_unpaired,
    });
  }

  return NextResponse.json({
    offeringPhase: offering.phase,
    activePhase,
    courseTitle: course?.title ?? "Trane Quiz",
    classDate: offering.class_date,
    preCompleted: !!participant.pre_completed_at,
    postCompleted: !!participant.post_completed_at,
    postUnpaired: participant.post_unpaired,
    needsUnpairedConfirm,
    phaseDone,
    answeredCount: answered.size,
    currentQuestionIndex,
    questions: publicQuestions,
    results,
  });
}
