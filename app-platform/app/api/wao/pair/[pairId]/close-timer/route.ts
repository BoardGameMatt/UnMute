import { withWorkshopTransaction, WorkshopWriteConflict } from "@/lib/session/workshop-transaction";
import { NextResponse } from "next/server";
import { authorizePairMember } from "@/lib/wao/authorize-pair";
import { broadcastPairEvent } from "@/lib/wao/broadcast";
import { ensureRoundScored } from "@/lib/wao/score-round";
import { WAO_SETTLE_SECONDS } from "@/lib/wao/types";
import type { WaoRound } from "@/lib/types/database";

type RouteContext = { params: { pairId: string } };

/**
 * Close the round after timer expiry + settle window.
 * This is the only way a round ends in v1 (lock_reason always 'timer').
 * Scoring runs once the round is locked (idempotent under double-close).
 */
export async function POST(_request: Request, context: RouteContext) {
  const auth = await authorizePairMember(context.params.pairId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const response = await withWorkshopTransaction(auth.admin, auth.waoSession.session_id, "action", async client => {
      const { data: fresh } = await client.from("wao_rounds").select("*").eq("id", auth.round.id).maybeSingle();
      if (!fresh) return NextResponse.json({ error: "The round no longer exists." }, { status: 409 });
      return closeAuthorizedRound({ ...auth, admin: client, round: fresh as WaoRound });
    });
    if (response.ok) {
      const result = await response.clone().json() as { lockedAt: string; lockReason: "timer" };
      await broadcastPairEvent(auth.admin, auth.round.id, auth.pair.id, { type: "round_locked", pairId: auth.pair.id, lockedAt: result.lockedAt, lockReason: result.lockReason });
    }
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not close the round." }, { status: error instanceof WorkshopWriteConflict ? 409 : 500 });
  }
}

type PairAuth = Extract<Awaited<ReturnType<typeof authorizePairMember>>, { ok: true }>;
async function closeAuthorizedRound(auth: PairAuth): Promise<Response> {
  let round: WaoRound = auth.round;
  let alreadyLocked = Boolean(auth.round.locked_at);

  if (!alreadyLocked) {
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

    if (updatedRound) {
      round = updatedRound as WaoRound;
      alreadyLocked = false;
    } else {
      const { data: reloaded } = await auth.admin
        .from("wao_rounds")
        .select("*")
        .eq("id", auth.round.id)
        .maybeSingle();
      if (reloaded) round = reloaded as WaoRound;
      alreadyLocked = true;
    }
  }

  if (!round.locked_at) {
    return NextResponse.json(
      { error: "Could not lock the round." },
      { status: 500 }
    );
  }

  const scored = await ensureRoundScored({
    admin: auth.admin,
    round,
    waoSession: auth.waoSession,
  });
  if (!scored.ok) {
    return NextResponse.json({ error: scored.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    alreadyLocked,
    lockedAt: round.locked_at,
    lockReason: round.lock_reason,
    scored: true,
  });
}
