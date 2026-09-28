import { NextResponse } from "next/server";
import { authorizeTruthIsParticipant } from "@/lib/protocols/the-truth-is/authorize";
import { buildTruthIsPlayState } from "@/lib/protocols/the-truth-is/play-state";

type RouteContext = { params: { sessionId: string } };

export async function GET(_request: Request, context: RouteContext) {
  const sessionId = context.params.sessionId;
  const auth = await authorizeTruthIsParticipant(sessionId, { allowCompleted: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const state = await buildTruthIsPlayState({
      admin: auth.admin,
      sessionId: auth.sessionId,
      participantId: auth.participantId,
      isLead: auth.isLead,
    });
    return NextResponse.json({ state });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load The Truth Is.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
