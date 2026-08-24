import { NextResponse } from "next/server";
import { authorizeTalkTrackParticipant } from "@/lib/protocols/talk-track/authorize";
import { buildTalkTrackPlayState } from "@/lib/protocols/talk-track/play-state";

type RouteContext = { params: { sessionId: string } };

export async function GET(_request: Request, context: RouteContext) {
  const sessionId = context.params.sessionId;
  const auth = await authorizeTalkTrackParticipant(sessionId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const state = await buildTalkTrackPlayState({
      admin: auth.admin,
      sessionId: auth.sessionId,
      participantId: auth.participantId,
      isLead: auth.isLead,
    });
    return NextResponse.json({ state });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load Talk Track.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
