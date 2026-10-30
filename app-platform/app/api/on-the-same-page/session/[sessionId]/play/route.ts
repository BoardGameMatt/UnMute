import { NextResponse } from "next/server";
import { authorizeOtspParticipant } from "@/lib/protocols/on-the-same-page/authorize";
import { loadOtspPlayState } from "@/lib/protocols/on-the-same-page/play-state";

type RouteContext = { params: { sessionId: string } };

export async function GET(request: Request, context: RouteContext) {
  const auth = await authorizeOtspParticipant(context.params.sessionId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const displayFlag = new URL(request.url).searchParams.get("display") === "1";
  const isDisplay = auth.isLead && (displayFlag || auth.isSharedScreen);

  try {
    const state = await loadOtspPlayState({
      admin: auth.admin,
      sessionId: auth.sessionId,
      participantId: auth.participantId,
      isDisplay,
      canControl: isDisplay,
    });
    return NextResponse.json({ state });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load On the Same Page.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
