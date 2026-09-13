import { NextResponse } from "next/server";
import { authorizeCodeSwitchParticipant } from "@/lib/protocols/code-switch/authorize";
import { buildCodeSwitchPlayState } from "@/lib/protocols/code-switch/play-state";

type RouteContext = { params: { sessionId: string } };

export async function GET(request: Request, context: RouteContext) {
  const sessionId = context.params.sessionId;
  const auth = await authorizeCodeSwitchParticipant(sessionId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const display = new URL(request.url).searchParams.get("display") === "1";

  try {
    const state = await buildCodeSwitchPlayState({
      admin: auth.admin,
      sessionId: auth.sessionId,
      participantId: auth.participantId,
      isLead: auth.isLead,
      isDisplay: display && auth.isLead,
    });
    return NextResponse.json({ state });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load SwitchCode.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
