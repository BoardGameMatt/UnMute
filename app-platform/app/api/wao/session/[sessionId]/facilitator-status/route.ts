import { NextResponse } from "next/server";
import { authorizeSessionLead } from "@/lib/wao/authorize-pair";
import type { WaoRound, WaoSession } from "@/lib/types/database";

type RouteContext = { params: { sessionId: string } };

/**
 * Facilitator post-round snapshot: enough to decide start-another vs end.
 * Not a leaderboard.
 */
export async function GET(_request: Request, context: RouteContext) {
  const auth = await authorizeSessionLead(context.params.sessionId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data: waoRaw, error: waoErr } = await auth.admin
    .from("wao_sessions")
    .select("*")
    .eq("session_id", auth.sessionId)
    .maybeSingle();

  if (waoErr) {
    return NextResponse.json({ error: waoErr.message }, { status: 500 });
  }
  if (!waoRaw) {
    return NextResponse.json(
      { error: "No Wrong Answers Only session for this room yet." },
      { status: 404 }
    );
  }

  const waoSession = waoRaw as WaoSession;

  const { data: roundsRaw, error: roundsErr } = await auth.admin
    .from("wao_rounds")
    .select("*")
    .eq("wao_session_id", waoSession.id)
    .order("round_number", { ascending: true });

  if (roundsErr) {
    return NextResponse.json({ error: roundsErr.message }, { status: 500 });
  }

  const rounds = (roundsRaw ?? []) as WaoRound[];
  const locked = rounds.filter((r) => r.locked_at !== null);
  const open = rounds.filter((r) => r.locked_at === null);
  const lastFinished =
    locked.length === 0
      ? null
      : locked.reduce((best, r) =>
          r.round_number > best.round_number ? r : best
        );

  return NextResponse.json({
    finishedRoundNumber: lastFinished?.round_number ?? null,
    roundsCompleted: locked.length,
    plannedRounds: waoSession.round_count,
    concurrenceRate: waoSession.concurrence_rate,
    hasOpenRound: open.length > 0,
    canStartAnother: open.length === 0,
    canEndSession: open.length === 0,
  });
}
