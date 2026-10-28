import { NextResponse } from "next/server";
import { dispatchSayLessAction } from "@/lib/protocols/say-less/actions";
import { authorizeSayLessParticipant } from "@/lib/protocols/say-less/authorize";
import { buildSayLessPlayState } from "@/lib/protocols/say-less/play-state";
import type { SayLessAction } from "@/lib/protocols/say-less/types";

type RouteContext = { params: { sessionId: string } };

const ACTION_TYPES = new Set<SayLessAction["type"]>([
  "setCategories",
  "swapPlayers",
  "confirmTeams",
  "startRound",
  "cardAction",
  "skipTurn",
  "pauseHold",
  "resumeHold",
  "endRound",
  "advance",
  "complete",
]);

export async function POST(request: Request, context: RouteContext) {
  const sessionId = context.params.sessionId;
  const auth = await authorizeSayLessParticipant(sessionId);
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
  if (!type || !ACTION_TYPES.has(type as SayLessAction["type"])) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const result = await dispatchSayLessAction({
    admin: auth.admin,
    sessionId: auth.sessionId,
    participantId: auth.participantId,
    isLead: auth.isLead,
    action: body as SayLessAction,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const state = await buildSayLessPlayState({
    admin: auth.admin,
    sessionId: auth.sessionId,
    participantId: auth.participantId,
    isLead: auth.isLead,
    skipMaintenance: true,
  });
  return NextResponse.json({ ok: true, state });
}
