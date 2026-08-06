import { NextResponse } from "next/server";
import { authorizePairMember } from "@/lib/wao/authorize-pair";
import { buildPairRevealState } from "@/lib/wao/build-reveal-state";

type RouteContext = { params: { pairId: string } };

/**
 * Participant reveal for this pair only. Requires round locked.
 * is_correct appears only in this post-score payload.
 */
export async function GET(_request: Request, context: RouteContext) {
  const auth = await authorizePairMember(context.params.pairId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const built = await buildPairRevealState({
    admin: auth.admin,
    participantId: auth.participantId,
    pair: auth.pair,
    round: auth.round,
    waoSession: auth.waoSession,
  });

  if (!built.ok) {
    return NextResponse.json({ error: built.error }, { status: built.status });
  }

  return NextResponse.json(built.state);
}
