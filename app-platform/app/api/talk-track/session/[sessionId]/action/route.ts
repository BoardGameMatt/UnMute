import { NextResponse } from "next/server";
import { dispatchTalkTrackAction } from "@/lib/protocols/talk-track/actions";
import { authorizeTalkTrackParticipant } from "@/lib/protocols/talk-track/authorize";
import { buildTalkTrackPlayState } from "@/lib/protocols/talk-track/play-state";
import type { TalkTrackAction } from "@/lib/protocols/talk-track/types";

type RouteContext = { params: { sessionId: string } };

const ACTION_TYPES = new Set<TalkTrackAction["type"]>([
  "advanceHold",
  "pauseHold",
  "resumeHold",
  "stop",
  "resolve",
  "timerExpired",
  "nudge",
  "anotherRound",
  "complete",
]);

export async function POST(request: Request, context: RouteContext) {
  const sessionId = context.params.sessionId;
  const auth = await authorizeTalkTrackParticipant(sessionId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { type?: string } & Record<string, unknown>;
  try {
    body = (await request.json()) as { type?: string } & Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const type = body.type;
  if (!type || !ACTION_TYPES.has(type as TalkTrackAction["type"])) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const result = await dispatchTalkTrackAction({
    admin: auth.admin,
    sessionId: auth.sessionId,
    participantId: auth.participantId,
    isLead: auth.isLead,
    action: body as TalkTrackAction,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const state = await buildTalkTrackPlayState({
    admin: auth.admin,
    sessionId: auth.sessionId,
    participantId: auth.participantId,
    isLead: auth.isLead,
    skipMaintenance: true,
  });
  return NextResponse.json({ ok: true, state });
}
