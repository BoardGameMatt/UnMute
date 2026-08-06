import { NextResponse } from "next/server";
import { authorizeSessionLead } from "@/lib/wao/authorize-pair";

type RouteContext = { params: { sessionId: string } };

/**
 * Facilitator ends the WAO session. Marks platform session completed so
 * SessionCompletedRedirect / feedback page take over (same path as DIBE/TTI).
 */
export async function POST(_request: Request, context: RouteContext) {
  const auth = await authorizeSessionLead(context.params.sessionId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data: waoSession, error: waoErr } = await auth.admin
    .from("wao_sessions")
    .select("id")
    .eq("session_id", auth.sessionId)
    .maybeSingle();

  if (waoErr) {
    return NextResponse.json({ error: waoErr.message }, { status: 500 });
  }

  if (waoSession) {
    const { data: openRounds, error: openErr } = await auth.admin
      .from("wao_rounds")
      .select("id")
      .eq("wao_session_id", waoSession.id)
      .is("locked_at", null);

    if (openErr) {
      return NextResponse.json({ error: openErr.message }, { status: 500 });
    }
    if ((openRounds ?? []).length > 0) {
      return NextResponse.json(
        {
          error:
            "A round is still in progress. Wait for it to finish before ending the session.",
        },
        { status: 409 }
      );
    }
  }

  const completedAt = new Date().toISOString();
  const { error: sessionErr } = await auth.admin
    .from("sessions")
    .update({
      status: "completed",
      completed_at: completedAt,
    })
    .eq("id", auth.sessionId);

  if (sessionErr) {
    return NextResponse.json({ error: sessionErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    status: "completed",
    completedAt,
  });
}
