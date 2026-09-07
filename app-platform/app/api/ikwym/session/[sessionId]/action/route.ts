import { NextResponse } from "next/server";
import { dispatchIkwymAction } from "@/lib/protocols/i-know-what-you-meme/actions";
import { authorizeIkwymParticipant } from "@/lib/protocols/i-know-what-you-meme/authorize";
import { buildIkwymPlayState } from "@/lib/protocols/i-know-what-you-meme/play-state";
import type { IkwymAction } from "@/lib/protocols/i-know-what-you-meme/types";

type RouteContext = { params: { sessionId: string } };

const ACTION_TYPES = new Set<IkwymAction["type"]>([
  "broadcastRound",
  "confirmGif",
  "lockGuess",
  "timerExpired",
  "nextReveal",
  "wrap",
  "advanceRecap",
]);

export async function POST(request: Request, context: RouteContext) {
  const sessionId = context.params.sessionId;
  let body: { type?: string } & Record<string, unknown>;
  try {
    body = (await request.json()) as { type?: string } & Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const type = body.type;
  if (!type || !ACTION_TYPES.has(type as IkwymAction["type"])) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const auth = await authorizeIkwymParticipant(sessionId, {
    allowCompleted: type === "advanceRecap",
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const result = await dispatchIkwymAction({
      admin: auth.admin,
      sessionId: auth.sessionId,
      participantId: auth.participantId,
      isLead: auth.isLead,
      action: body as IkwymAction,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    if (type === "advanceRecap") {
      return NextResponse.json({ ok: true });
    }

    const state = await buildIkwymPlayState({
      admin: auth.admin,
      sessionId: auth.sessionId,
      participantId: auth.participantId,
      isLead: auth.isLead,
      skipMaintenance: true,
    });
    return NextResponse.json({ ok: true, state });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Action failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
