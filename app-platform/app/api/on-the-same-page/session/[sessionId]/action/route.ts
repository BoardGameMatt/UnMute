import { NextResponse } from "next/server";
import { dispatchOtspAction, finishOnTheSamePage } from "@/lib/protocols/on-the-same-page/actions";
import { authorizeOtspParticipant } from "@/lib/protocols/on-the-same-page/authorize";
import { isReactionKind, isTileId } from "@/lib/protocols/on-the-same-page/config";
import { loadOtspPlayState } from "@/lib/protocols/on-the-same-page/play-state";
import type { ActorAction } from "@/lib/protocols/on-the-same-page/types";

type RouteContext = { params: { sessionId: string } };

function parseAction(body: Record<string, unknown>, actorId: string): ActorAction | "complete" | null {
  const type = body.type;
  if (type === "complete") return "complete";
  if (type === "expire") return { type, actorId };
  if (type === "anotherRound" || type === "scoreboard") return { type, actorId };
  if ((type === "preview" || type === "place") && isTileId(body.tile) && typeof body.row === "number" && typeof body.col === "number") {
    return { type, actorId, tile: body.tile, row: body.row, col: body.col };
  }
  if (type === "guess" && typeof body.itemId === "string") return { type, actorId, itemId: body.itemId };
  if (type === "pin" && (body.targetId === null || typeof body.targetId === "string")) {
    return { type, actorId, targetId: body.targetId as string | null };
  }
  if (type === "react" && isReactionKind(body.kind)) {
    const tileKey = typeof body.tileKey === "string" ? body.tileKey.slice(0, 40) : null;
    return { type, actorId, kind: body.kind, tileKey };
  }
  return null;
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await authorizeOtspParticipant(context.params.sessionId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object") return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const action = parseAction(body, auth.participantId);
  if (!action) return NextResponse.json({ error: "Unknown action." }, { status: 400 });

  const displayFlag = new URL(request.url).searchParams.get("display") === "1";
  const isDisplay = auth.isLead && (displayFlag || auth.isSharedScreen);

  try {
    const result =
      action === "complete"
        ? await finishOnTheSamePage({ admin: auth.admin, sessionId: auth.sessionId, canControl: isDisplay })
        : await dispatchOtspAction({
            admin: auth.admin,
            sessionId: auth.sessionId,
            participantId: auth.participantId,
            canControl: isDisplay,
            isDisplay,
            action,
          });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    if (action === "complete") return NextResponse.json({ ok: true, state: null });

    const state = await loadOtspPlayState({
      admin: auth.admin,
      sessionId: auth.sessionId,
      participantId: auth.participantId,
      isDisplay,
      canControl: isDisplay,
      skipMaintenance: true,
    });
    return NextResponse.json({ ok: true, state });
  } catch (err) {
    const message = err instanceof Error ? err.message : "On the Same Page action failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
