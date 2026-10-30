import { NextResponse } from "next/server";
import { dispatchZoningRightsAction } from "@/lib/protocols/zoning-rights/actions";
import { authorizeZoningRightsParticipant } from "@/lib/protocols/zoning-rights/authorize";
import { buildZoningRightsPlayState } from "@/lib/protocols/zoning-rights/play-state";
import type { ZoningRightsAction } from "@/lib/protocols/zoning-rights/types";

type RouteContext = { params: { sessionId: string } };

const ACTION_TYPES = new Set<ZoningRightsAction["type"]>([
  "selectLots",
  "lockLots",
  "lockZmAssignment",
  "placeGuess",
  "lockGuess",
  "timerExpired",
  "continue",
  "anotherRound",
  "moveToTeamPlay",
  "skipPlanner",
  "placeTeamGuess",
  "lockTeam",
  "complete",
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
  if (!type || !ACTION_TYPES.has(type as ZoningRightsAction["type"])) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const auth = await authorizeZoningRightsParticipant(sessionId, {
    allowCompleted: type === "advanceRecap",
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await dispatchZoningRightsAction({
    admin: auth.admin,
    sessionId: auth.sessionId,
    participantId: auth.participantId,
    isLead: auth.isLead,
    action: body as ZoningRightsAction,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (type === "advanceRecap") {
    return NextResponse.json({ ok: true });
  }

  const state = await buildZoningRightsPlayState({
    admin: auth.admin,
    sessionId: auth.sessionId,
    participantId: auth.participantId,
    isLead: auth.isLead,
    skipMaintenance: true,
  });
  return NextResponse.json({ ok: true, state });
}
