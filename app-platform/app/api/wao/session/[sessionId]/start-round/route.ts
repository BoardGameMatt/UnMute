import { NextResponse } from "next/server";
import { authorizeSessionLead } from "@/lib/wao/authorize-pair";
import { startWaoRound } from "@/lib/wao/start-round";

type RouteContext = { params: { sessionId: string } };

type StartBody = {
  includeInactive?: unknown;
};

/**
 * Facilitator starts one playable round: wao_session, question draw, pairs.
 * Auth: session lead only (same check as lobby requireLead / action route).
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await authorizeSessionLead(context.params.sessionId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let includeInactive = false;
  try {
    const body = (await request.json()) as StartBody;
    includeInactive = body.includeInactive === true;
  } catch {
    // Empty body is fine — production-style active-only draw.
  }

  const result = await startWaoRound({
    admin: auth.admin,
    sessionId: auth.sessionId,
    includeInactive,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    waoSessionId: result.waoSession.id,
    roundId: result.round.id,
    roundNumber: result.round.round_number,
    questionId: result.questionId,
    pairCount: result.pairCount,
    sitOut: result.sitOut,
    includedInactive: result.includedInactive,
    startedAt: result.round.started_at,
  });
}
