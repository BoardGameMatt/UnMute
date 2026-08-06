import { NextResponse } from "next/server";
import { authorizePairMember } from "@/lib/wao/authorize-pair";
import { buildPairPlayState } from "@/lib/wao/build-pair-state";

type RouteContext = { params: { pairId: string } };

/** Recover current pair play state after reconnect. */
export async function GET(_request: Request, context: RouteContext) {
  const auth = await authorizePairMember(context.params.pairId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const built = await buildPairPlayState({
    admin: auth.admin,
    participantId: auth.participantId,
    pair: auth.pair,
    round: auth.round,
    waoSession: auth.waoSession,
  });

  if (!built.ok) {
    return NextResponse.json({ error: built.error }, { status: 500 });
  }

  return NextResponse.json(built.state);
}
