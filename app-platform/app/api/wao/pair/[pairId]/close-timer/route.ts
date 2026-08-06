import { NextResponse } from "next/server";
import { authorizePairMember } from "@/lib/wao/authorize-pair";
import { broadcastPairEvent } from "@/lib/wao/broadcast";
import { WAO_SETTLE_SECONDS } from "@/lib/wao/types";
import type { WaoRound } from "@/lib/types/database";

type RouteContext = { params: { pairId: string } };

/**
 * Close the round after timer expiry + settle window.
 * Server checks wall clock against started_at + timer_seconds + settle.
 * Scoring is out of scope; this only sets locked_at / lock_reason.
 */
export async function POST(_request: Request, context: RouteContext) {
  const auth = await authorizePairMember(context.params.pairId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (auth.round.locked_at) {
    return NextResponse.json({
      ok: true,
      alreadyLocked: true,
      lockedAt: auth.round.locked_at,
      lockReason: auth.round.lock_reason,
    });
  }

  if (!auth.round.started_at) {
    return NextResponse.json({ error: "Round has not started." }, { status: 409 });
  }

  const startedMs = Date.parse(auth.round.started_at);
  const closeAfterMs =
    startedMs + (auth.waoSession.timer_seconds + WAO_SETTLE_SECONDS) * 1000;

  if (Date.now() < closeAfterMs) {
    return NextResponse.json(
      { error: "Settle window has not elapsed." },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();

  const { data: updatedRound, error: roundErr } = await auth.admin
    .from("wao_rounds")
    .update({ locked_at: now, lock_reason: "timer" })
    .eq("id", auth.round.id)
    .is("locked_at", null)
    .select("*")
    .maybeSingle();

  if (roundErr) {
    return NextResponse.json({ error: roundErr.message }, { status: 500 });
  }

  let round: WaoRound = auth.round;
  if (updatedRound) {
    round = updatedRound as WaoRound;
  } else {
    const { data: reloaded } = await auth.admin
      .from("wao_rounds")
      .select("*")
      .eq("id", auth.round.id)
      .maybeSingle();
    if (reloaded) round = reloaded as WaoRound;
  }

  await broadcastPairEvent(auth.admin, auth.round.id, auth.pair.id, {
    type: "lock",
    pairId: auth.pair.id,
    participantId: auth.participantId,
    lockedAAt: auth.pair.locked_a_at,
    lockedBAt: auth.pair.locked_b_at,
    lockedAt: round.locked_at,
    lockReason: round.lock_reason,
  });

  return NextResponse.json({
    ok: true,
    alreadyLocked: false,
    lockedAt: round.locked_at,
    lockReason: round.lock_reason,
  });
}
