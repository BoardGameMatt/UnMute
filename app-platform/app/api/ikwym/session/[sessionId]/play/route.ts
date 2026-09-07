import { NextResponse } from "next/server";
import { authorizeIkwymParticipant } from "@/lib/protocols/i-know-what-you-meme/authorize";
import { buildIkwymPlayState } from "@/lib/protocols/i-know-what-you-meme/play-state";

type RouteContext = { params: { sessionId: string } };

export async function GET(_request: Request, context: RouteContext) {
  const sessionId = context.params.sessionId;
  const auth = await authorizeIkwymParticipant(sessionId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const state = await buildIkwymPlayState({
      admin: auth.admin,
      sessionId: auth.sessionId,
      participantId: auth.participantId,
      isLead: auth.isLead,
    });
    return NextResponse.json({ state });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load I Know What You Meme.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
