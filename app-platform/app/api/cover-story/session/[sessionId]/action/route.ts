import { NextResponse } from "next/server";
import { authorizeCoverStoryParticipant } from "@/lib/cover-story/authorize";
import type { CoverStoryAction } from "@/lib/cover-story/types";
import { dispatchCoverStoryAction, expireGuessIfNeeded } from "@/lib/cover-story/actions";
import { buildPlayState } from "@/lib/cover-story/play-state";
import { ensureCoverStorySession } from "@/lib/cover-story/session";

type RouteContext = { params: { sessionId: string } };

const ACTION_TYPES = new Set<CoverStoryAction["type"]>([
  "setRevealDate",
  "startReading",
  "setReadingProgress",
  "forceAdvanceReader",
  "gateDiscussion",
  "setPlayback",
  "openInsights",
  "openDeal",
  "ensureDeal",
  "lockAgency",
  "openField",
  "submitMissionReport",
  "admitLate",
  "startReveal",
  "beginGuessing",
  "submitGuess",
  "closeGuessWindow",
  "revealCover",
  "openScoring",
  "setMarks",
  "finalizeTarget",
  "showPoints",
  "nextTarget",
  "skipTarget",
  "scoreWithoutStory",
  "showFinal",
  "completeSession",
]);

export async function POST(request: Request, context: RouteContext) {
  const sessionId = context.params.sessionId;
  const auth = await authorizeCoverStoryParticipant(sessionId);
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
  if (!type || !ACTION_TYPES.has(type as CoverStoryAction["type"])) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const action = body as CoverStoryAction;
  const result = await dispatchCoverStoryAction({
    admin: auth.admin,
    sessionId: auth.sessionId,
    participantId: auth.participantId,
    isLead: auth.isLead,
    action,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const cs = await ensureCoverStorySession(auth.admin, auth.sessionId);
  const current = await expireGuessIfNeeded(auth.admin, auth.sessionId, cs);
  const state = await buildPlayState({
    admin: auth.admin,
    sessionId: auth.sessionId,
    participantId: auth.participantId,
    isLead: auth.isLead,
    cs: current,
  });
  return NextResponse.json({ ok: true, state });
}
