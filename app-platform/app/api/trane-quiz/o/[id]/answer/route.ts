import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireParticipant } from "@/lib/trane-quiz/auth";
import {
  QUESTIONS_PER_COURSE,
  TRANE_QUIZ_PARTICIPANT_COOKIE,
} from "@/lib/trane-quiz/constants";
import { responsePhaseForOffering } from "@/lib/trane-quiz/phases";
import type { TraneQuestion, TraneQuestionOption } from "@/lib/types/database";

type AnswerBody = {
  questionId?: unknown;
  selectedOption?: unknown;
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

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const participantId = cookies().get(TRANE_QUIZ_PARTICIPANT_COOKIE)?.value;
  const auth = await requireParticipant(params.id, participantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const activePhase = responsePhaseForOffering(auth.offering.phase);
  if (!activePhase) {
    return NextResponse.json({ error: "Quiz is not open" }, { status: 409 });
  }

  if (activePhase === "pre" && auth.participant.pre_completed_at) {
    return NextResponse.json({ error: "Already completed" }, { status: 409 });
  }
  if (activePhase === "post" && auth.participant.post_completed_at) {
    return NextResponse.json({ error: "Already completed" }, { status: 409 });
  }

  if (
    activePhase === "post" &&
    !auth.participant.pre_completed_at &&
    !auth.participant.post_unpaired_confirmed_at
  ) {
    return NextResponse.json(
      { error: "Confirm end-only quiz first" },
      { status: 409 }
    );
  }

  let body: AnswerBody;
  try {
    body = (await req.json()) as AnswerBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const questionId =
    typeof body.questionId === "string" ? body.questionId : "";
  const selectedOption =
    typeof body.selectedOption === "string" ? body.selectedOption : "";

  if (!questionId || !selectedOption) {
    return NextResponse.json(
      { error: "questionId and selectedOption required" },
      { status: 400 }
    );
  }

  const { data: question, error: qErr } = await auth.admin
    .from("trane_questions")
    .select("id, course_id, options, sort_order")
    .eq("id", questionId)
    .maybeSingle();

  if (qErr || !question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const q = question as Pick<
    TraneQuestion,
    "id" | "course_id" | "options" | "sort_order"
  >;
  if (q.course_id !== auth.offering.course_id) {
    return NextResponse.json({ error: "Question mismatch" }, { status: 400 });
  }

  const options = parseOptions(q.options);
  if (!options.some((o) => o.key === selectedOption)) {
    return NextResponse.json({ error: "Invalid option" }, { status: 400 });
  }

  // No edit after submit
  const { data: existing } = await auth.admin
    .from("trane_responses")
    .select("id")
    .eq("offering_id", auth.offering.id)
    .eq("participant_id", auth.participant.id)
    .eq("phase", activePhase)
    .eq("question_id", questionId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "Already answered — cannot edit" },
      { status: 409 }
    );
  }

  const { error: insertErr } = await auth.admin.from("trane_responses").insert({
    offering_id: auth.offering.id,
    participant_id: auth.participant.id,
    question_id: questionId,
    phase: activePhase,
    selected_option: selectedOption,
  });

  if (insertErr) {
    if (insertErr.code === "23505") {
      return NextResponse.json(
        { error: "Already answered — cannot edit" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Could not save answer" },
      { status: 500 }
    );
  }

  const { count } = await auth.admin
    .from("trane_responses")
    .select("id", { count: "exact", head: true })
    .eq("offering_id", auth.offering.id)
    .eq("participant_id", auth.participant.id)
    .eq("phase", activePhase);

  const answeredCount = count ?? 0;
  let completed = false;

  if (answeredCount >= QUESTIONS_PER_COURSE) {
    completed = true;
    const patch =
      activePhase === "pre"
        ? { pre_completed_at: new Date().toISOString() }
        : { post_completed_at: new Date().toISOString() };
    const { error: completeErr } = await auth.admin
      .from("trane_participants")
      .update(patch)
      .eq("id", auth.participant.id);
    if (completeErr) {
      return NextResponse.json(
        { error: "Answers saved but could not mark complete — retry" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    answeredCount,
    completed,
    sortOrder: q.sort_order,
  });
}
