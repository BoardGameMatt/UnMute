import { NextResponse } from "next/server";
import { authorizePairMember } from "@/lib/wao/authorize-pair";
import { broadcastPairEvent } from "@/lib/wao/broadcast";
import type { WaoPair, WaoRound } from "@/lib/types/database";

type RouteContext = { params: { pairId: string } };

/**
 * Record Lock It In for the caller. When both partners have locked (or solo),
 * close the round with lock_reason both_locked. Scoring is out of scope.
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
      lockedAAt: auth.pair.locked_a_at,
      lockedBAt: auth.pair.locked_b_at,
      lockedAt: auth.round.locked_at,
      lockReason: auth.round.lock_reason,
    });
  }

  const now = new Date().toISOString();
  const isA = auth.participantId === auth.pair.participant_a;

  const pairPatch = isA
    ? { locked_a_at: auth.pair.locked_a_at ?? now }
    : { locked_b_at: auth.pair.locked_b_at ?? now };

  const { data: updatedPair, error: pairErr } = await auth.admin
    .from("wao_pairs")
    .update(pairPatch)
    .eq("id", auth.pair.id)
    .select("*")
    .maybeSingle();

  if (pairErr || !updatedPair) {
    return NextResponse.json(
      { error: pairErr?.message ?? "Could not record lock." },
      { status: 500 }
    );
  }

  const pair = updatedPair as WaoPair;

  const bothLocked = pair.is_solo
    ? pair.locked_a_at !== null
    : pair.locked_a_at !== null && pair.locked_b_at !== null;

  let round: WaoRound = auth.round;

  if (bothLocked && !auth.round.locked_at) {
    const { data: updatedRound, error: roundErr } = await auth.admin
      .from("wao_rounds")
      .update({ locked_at: now, lock_reason: "both_locked" })
      .eq("id", auth.round.id)
      .is("locked_at", null)
      .select("*")
      .maybeSingle();

    if (roundErr) {
      return NextResponse.json({ error: roundErr.message }, { status: 500 });
    }
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
  }

  await broadcastPairEvent(auth.admin, auth.round.id, auth.pair.id, {
    type: "lock",
    pairId: auth.pair.id,
    participantId: auth.participantId,
    lockedAAt: pair.locked_a_at,
    lockedBAt: pair.locked_b_at,
    lockedAt: round.locked_at,
    lockReason: round.lock_reason,
  });

  return NextResponse.json({
    ok: true,
    alreadyLocked: false,
    lockedAAt: pair.locked_a_at,
    lockedBAt: pair.locked_b_at,
    lockedAt: round.locked_at,
    lockReason: round.lock_reason,
  });
}
