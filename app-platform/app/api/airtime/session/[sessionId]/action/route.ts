import { NextResponse } from "next/server";
import { dispatchAirtimeAction } from "@/lib/protocols/airtime/actions";
import { authorizeAirtimeParticipant } from "@/lib/protocols/airtime/authorize";
import { loadAirtimePlayState } from "@/lib/protocols/airtime/play-state";
import type { AirtimeAction } from "@/lib/protocols/airtime/types";

type RouteContext = { params: { sessionId: string } };

const ACTION_TYPES = new Set<AirtimeAction["type"]>([
  "choose",
  "timerExpired",
  "swap",
  "showRules",
  "startDive",
  "endAfterTurn",
  "nextDive",
  "finalScore",
  "advanceRecap",
]);

export async function POST(request: Request, context: RouteContext) {
  const auth = await authorizeAirtimeParticipant(context.params.sessionId);
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
  if (!type || !ACTION_TYPES.has(type as AirtimeAction["type"])) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const displayFlag = new URL(request.url).searchParams.get("display") === "1";
  const isDisplay = auth.isLead && (displayFlag || auth.isSharedScreen);

  try {
    const result = await dispatchAirtimeAction({
      admin: auth.admin,
      sessionId: auth.sessionId,
      participantId: auth.participantId,
      canControl: isDisplay,
      isDisplay,
      action: body as AirtimeAction,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    if (type === "advanceRecap") return NextResponse.json({ ok: true, state: null });

    const state = await loadAirtimePlayState({
      admin: auth.admin,
      sessionId: auth.sessionId,
      participantId: auth.participantId,
      isDisplay,
      canControl: isDisplay,
      skipMaintenance: true,
    });
    return NextResponse.json({ ok: true, state });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Airtime action failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
