import { NextResponse } from "next/server";
import { dispatchCodeSwitchAction } from "@/lib/protocols/code-switch/actions";
import { authorizeCodeSwitchParticipant } from "@/lib/protocols/code-switch/authorize";
import { buildCodeSwitchPlayState } from "@/lib/protocols/code-switch/play-state";
import type { CodeSwitchAction } from "@/lib/protocols/code-switch/types";

type RouteContext = { params: { sessionId: string } };

const ACTION_TYPES = new Set<CodeSwitchAction["type"]>([
  "lockClue",
  "lockGuess",
  "timerExpired",
  "anotherRound",
  "wrap",
  "advanceRecap",
]);

export async function POST(request: Request, context: RouteContext) {
  const sessionId = context.params.sessionId;
  const auth = await authorizeCodeSwitchParticipant(sessionId);
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
  if (!type || !ACTION_TYPES.has(type as CodeSwitchAction["type"])) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const result = await dispatchCodeSwitchAction({
    admin: auth.admin,
    sessionId: auth.sessionId,
    participantId: auth.participantId,
    isLead: auth.isLead,
    action: body as CodeSwitchAction,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const display = new URL(request.url).searchParams.get("display") === "1";
  const state = await buildCodeSwitchPlayState({
    admin: auth.admin,
    sessionId: auth.sessionId,
    participantId: auth.participantId,
    isLead: auth.isLead,
    isDisplay: display && auth.isLead,
    skipMaintenance: true,
  });
  return NextResponse.json({ ok: true, state });
}
