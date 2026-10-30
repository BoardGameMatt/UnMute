import { NextResponse } from "next/server";
import { dispatchRankAndFileAction } from "@/lib/protocols/rank-and-file/actions";
import { authorizeRankAndFileParticipant } from "@/lib/protocols/rank-and-file/authorize";
import { buildRankAndFilePlayState } from "@/lib/protocols/rank-and-file/play-state";
import type { RankAndFileAction } from "@/lib/protocols/rank-and-file/types";

type RouteContext = { params: { sessionId: string } };

const ACTION_TYPES = new Set<RankAndFileAction["type"]>([
  "lockClue",
  "timerExpired",
  "setRail",
  "commit",
  "nextRound",
  "anotherRound",
  "wrap",
  "advanceRecap",
]);

export async function POST(request: Request, context: RouteContext) {
  const sessionId = context.params.sessionId;
  const auth = await authorizeRankAndFileParticipant(sessionId);
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
  if (!type || !ACTION_TYPES.has(type as RankAndFileAction["type"])) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const display = new URL(request.url).searchParams.get("display") === "1";
  const result = await dispatchRankAndFileAction({
    admin: auth.admin,
    sessionId: auth.sessionId,
    participantId: auth.participantId,
    isLead: auth.isLead,
    isDisplay: display && auth.isLead,
    action: body as RankAndFileAction,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const state = await buildRankAndFilePlayState({
    admin: auth.admin,
    sessionId: auth.sessionId,
    participantId: auth.participantId,
    isLead: auth.isLead,
    isDisplay: display && auth.isLead,
    skipMaintenance: true,
  });
  return NextResponse.json({ ok: true, state });
}
