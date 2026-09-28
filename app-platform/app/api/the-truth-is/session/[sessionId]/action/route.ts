import { NextResponse } from "next/server";
import { dispatchTruthIsAction } from "@/lib/protocols/the-truth-is/actions";
import { authorizeTruthIsParticipant } from "@/lib/protocols/the-truth-is/authorize";
import { buildTruthIsPlayState } from "@/lib/protocols/the-truth-is/play-state";
import type { TruthIsClientAction } from "@/lib/protocols/the-truth-is/types";

type RouteContext = { params: { sessionId: string } };

function parseAction(body: Record<string, unknown>): TruthIsClientAction | null {
  const type = body.type;
  if (
    type === "timerExpired" ||
    type === "readyToVote" ||
    type === "processReveal" ||
    type === "dismissLeaderboard"
  ) {
    return { type };
  }
  if (type === "leaderFewMore" || type === "oneMoreRound" || type === "wrapUp" || type === "advanceRecap") {
    return { type };
  }
  if (type === "submitEntry" || type === "submitOnTimeout") {
    const round = body.round;
    if (typeof body.text !== "string" || (round !== 1 && round !== 2)) return null;
    return { type, text: body.text, round };
  }
  if (type === "submitVote") {
    if (typeof body.guessedAuthorId !== "string" || !body.guessedAuthorId) return null;
    return { type, guessedAuthorId: body.guessedAuthorId };
  }
  return null;
}

export async function POST(request: Request, context: RouteContext) {
  const sessionId = context.params.sessionId;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const action = parseAction(body);
  if (!action) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const auth = await authorizeTruthIsParticipant(sessionId, {
    allowCompleted: action.type === "advanceRecap",
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const result = await dispatchTruthIsAction({
      admin: auth.admin,
      sessionId: auth.sessionId,
      participantId: auth.participantId,
      isLead: auth.isLead,
      action,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    if (action.type === "advanceRecap") {
      return NextResponse.json({ ok: true });
    }

    const state = await buildTruthIsPlayState({
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
