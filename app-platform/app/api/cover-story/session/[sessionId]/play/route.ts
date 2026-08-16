import { NextResponse } from "next/server";
import { expireGuessIfNeeded } from "@/lib/cover-story/actions";
import { authorizeCoverStoryParticipant } from "@/lib/cover-story/authorize";
import { buildPlayState } from "@/lib/cover-story/play-state";
import { ensureCoverStorySession } from "@/lib/cover-story/session";

type RouteContext = { params: { sessionId: string } };

export async function GET(_request: Request, context: RouteContext) {
  const sessionId = context.params.sessionId;
  const auth = await authorizeCoverStoryParticipant(sessionId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const cs = await ensureCoverStorySession(auth.admin, auth.sessionId);
    const current = await expireGuessIfNeeded(auth.admin, auth.sessionId, cs);
    const state = await buildPlayState({
      admin: auth.admin,
      sessionId: auth.sessionId,
      participantId: auth.participantId,
      isLead: auth.isLead,
      cs: current,
    });
    return NextResponse.json({ state });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load Cover Story.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
