import { NextResponse } from "next/server";
import { authorizeAirtimeParticipant } from "@/lib/protocols/airtime/authorize";
import { loadAirtimePlayState } from "@/lib/protocols/airtime/play-state";

type RouteContext = { params: { sessionId: string } };

export async function GET(request: Request, context: RouteContext) {
  const auth = await authorizeAirtimeParticipant(context.params.sessionId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const displayFlag = new URL(request.url).searchParams.get("display") === "1";
  const isDisplay = auth.isLead && (displayFlag || auth.isSharedScreen);

  try {
    const state = await loadAirtimePlayState({
      admin: auth.admin,
      sessionId: auth.sessionId,
      participantId: auth.participantId,
      isDisplay,
      canControl: isDisplay,
    });
    return NextResponse.json({ state });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load Airtime.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
