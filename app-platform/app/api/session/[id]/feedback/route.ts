import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { PARTICIPANT_COOKIE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

type FeedbackBody = {
  rating?: unknown;
  comment?: unknown;
};

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const sessionId = params.id;
  const cookieStore = cookies();
  const participantId = cookieStore.get(PARTICIPANT_COOKIE)?.value ?? null;

  if (!participantId) {
    return NextResponse.json({ error: "Not authenticated for this session." }, { status: 401 });
  }

  let body: FeedbackBody;
  try {
    body = (await req.json()) as FeedbackBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rating = body.rating;
  const commentRaw = body.comment;

  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 10) {
    return NextResponse.json({ error: "rating must be an integer 1–10" }, { status: 400 });
  }

  let comment: string | null = null;
  if (commentRaw !== undefined && commentRaw !== null) {
    if (typeof commentRaw !== "string") {
      return NextResponse.json({ error: "comment must be a string" }, { status: 400 });
    }
    const trimmed = commentRaw.trim();
    if (trimmed.length > 500) {
      return NextResponse.json({ error: "comment must be at most 500 characters" }, { status: 400 });
    }
    comment = trimmed.length > 0 ? trimmed : null;
  }

  const supabase = createClient();

  const { data: sessionRow, error: sessionErr } = await supabase
    .from("sessions")
    .select("id, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionErr) {
    return NextResponse.json({ error: sessionErr.message }, { status: 500 });
  }

  if (!sessionRow || sessionRow.status !== "completed") {
    return NextResponse.json({ error: "Session is not completed." }, { status: 400 });
  }

  const { data: link, error: linkErr } = await supabase
    .from("session_participants")
    .select("id")
    .eq("session_id", sessionId)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (linkErr) {
    return NextResponse.json({ error: linkErr.message }, { status: 500 });
  }

  if (!link) {
    return NextResponse.json({ error: "Not a participant in this session." }, { status: 403 });
  }

  const { error: insertErr } = await supabase.from("session_feedback").insert({
    session_id: sessionId,
    participant_id: participantId,
    rating,
    comment,
  });

  if (insertErr) {
    if (insertErr.code === "23505") {
      return NextResponse.json({ error: "Feedback already submitted." }, { status: 409 });
    }
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
