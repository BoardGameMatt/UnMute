import { NextResponse } from "next/server";
import { authorizeSayLessParticipant } from "@/lib/protocols/say-less/authorize";
import { buildSayLessPlayState } from "@/lib/protocols/say-less/play-state";

type RouteContext = { params: { sessionId: string } };

export async function GET(_request: Request, context: RouteContext) {
  const sessionId = context.params.sessionId;
  const auth = await authorizeSayLessParticipant(sessionId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const state = await buildSayLessPlayState({
      admin: auth.admin,
      sessionId: auth.sessionId,
      participantId: auth.participantId,
      isLead: auth.isLead,
    });
    return NextResponse.json({ state });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load Say Less.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
