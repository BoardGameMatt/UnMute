import { NextResponse } from "next/server";
import { authorizeZoningRightsParticipant } from "@/lib/protocols/zoning-rights/authorize";
import { buildZoningRightsPlayState } from "@/lib/protocols/zoning-rights/play-state";

type RouteContext = { params: { sessionId: string } };

export async function GET(_request: Request, context: RouteContext) {
  const sessionId = context.params.sessionId;
  const auth = await authorizeZoningRightsParticipant(sessionId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const state = await buildZoningRightsPlayState({
      admin: auth.admin,
      sessionId: auth.sessionId,
      participantId: auth.participantId,
      isLead: auth.isLead,
    });
    return NextResponse.json({ state });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load Zoning Rights.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
