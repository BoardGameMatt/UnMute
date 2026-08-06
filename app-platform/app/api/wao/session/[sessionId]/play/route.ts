import { NextResponse } from "next/server";
import { authorizeSessionParticipant } from "@/lib/wao/authorize-pair";
import { buildPairPlayState } from "@/lib/wao/build-pair-state";
import type { WaoPair, WaoRound, WaoSession } from "@/lib/types/database";

type RouteContext = { params: { sessionId: string } };

/**
 * Discover the caller's current open pair for this platform session.
 * Auth: cookie + session_participants, then service client for WAO rows.
 */
export async function GET(_request: Request, context: RouteContext) {
  const auth = await authorizeSessionParticipant(context.params.sessionId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data: waoSessionRaw, error: waoSessionErr } = await auth.admin
    .from("wao_sessions")
    .select("*")
    .eq("session_id", auth.sessionId)
    .maybeSingle();

  if (waoSessionErr) {
    return NextResponse.json({ error: waoSessionErr.message }, { status: 500 });
  }
  if (!waoSessionRaw) {
    return NextResponse.json(
      { error: "No Wrong Answers Only session for this room yet." },
      { status: 404 }
    );
  }

  const waoSession = waoSessionRaw as WaoSession;

  const { data: rounds, error: roundsErr } = await auth.admin
    .from("wao_rounds")
    .select("*")
    .eq("wao_session_id", waoSession.id)
    .order("round_number", { ascending: false });

  if (roundsErr) {
    return NextResponse.json({ error: roundsErr.message }, { status: 500 });
  }

  const roundList = (rounds ?? []) as WaoRound[];
  if (roundList.length === 0) {
    return NextResponse.json(
      { error: "No round has been started yet." },
      { status: 404 }
    );
  }

  // Prefer an unlocked round so a just-started round wins over a locked prior.
  const ordered = [
    ...roundList.filter((r) => r.locked_at === null),
    ...roundList.filter((r) => r.locked_at !== null),
  ];

  for (const round of ordered) {
    const { data: pairs, error: pairsErr } = await auth.admin
      .from("wao_pairs")
      .select("*")
      .eq("round_id", round.id);

    if (pairsErr) {
      return NextResponse.json({ error: pairsErr.message }, { status: 500 });
    }

    const mine = ((pairs ?? []) as WaoPair[]).find(
      (p) =>
        p.participant_a === auth.participantId ||
        p.participant_b === auth.participantId
    );

    if (!mine) continue;

    const built = await buildPairPlayState({
      admin: auth.admin,
      participantId: auth.participantId,
      pair: mine,
      round,
      waoSession,
    });

    if (!built.ok) {
      return NextResponse.json({ error: built.error }, { status: 500 });
    }

    return NextResponse.json(built.state);
  }

  return NextResponse.json(
    { error: "You are not paired in the current round." },
    { status: 404 }
  );
}
