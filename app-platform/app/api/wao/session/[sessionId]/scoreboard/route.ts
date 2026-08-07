import { NextResponse } from "next/server";
import { authorizeSessionParticipant } from "@/lib/wao/authorize-pair";
import type { WaoPair, WaoRound, WaoRoundResult, WaoSession } from "@/lib/types/database";

type RouteContext = { params: { sessionId: string } };

export type WaoScoreboardEntry = {
  participantId: string;
  displayName: string;
  totalScore: number;
};

/**
 * Session totals after end: sum of pair round scores per participant,
 * highest first, plus concurrence rate. Any session member may read.
 */
export async function GET(_request: Request, context: RouteContext) {
  const auth = await authorizeSessionParticipant(context.params.sessionId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data: sessionRow, error: sessionErr } = await auth.admin
    .from("sessions")
    .select("id, status")
    .eq("id", auth.sessionId)
    .maybeSingle();

  if (sessionErr) {
    return NextResponse.json({ error: sessionErr.message }, { status: 500 });
  }
  if (!sessionRow) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }
  if (sessionRow.status !== "completed") {
    return NextResponse.json(
      { error: "Scoreboard is available after the session ends." },
      { status: 409 }
    );
  }

  const { data: waoRaw, error: waoErr } = await auth.admin
    .from("wao_sessions")
    .select("*")
    .eq("session_id", auth.sessionId)
    .maybeSingle();

  if (waoErr) {
    return NextResponse.json({ error: waoErr.message }, { status: 500 });
  }
  if (!waoRaw) {
    return NextResponse.json(
      { error: "No Wrong Answers Only session for this room." },
      { status: 404 }
    );
  }

  const waoSession = waoRaw as WaoSession;

  const { data: roundsRaw, error: roundsErr } = await auth.admin
    .from("wao_rounds")
    .select("*")
    .eq("wao_session_id", waoSession.id)
    .not("locked_at", "is", null);

  if (roundsErr) {
    return NextResponse.json({ error: roundsErr.message }, { status: 500 });
  }

  const rounds = (roundsRaw ?? []) as WaoRound[];
  const totals = new Map<string, number>();

  if (rounds.length > 0) {
    const roundIds = rounds.map((r) => r.id);
    const { data: pairsRaw, error: pairsErr } = await auth.admin
      .from("wao_pairs")
      .select("*")
      .in("round_id", roundIds);

    if (pairsErr) {
      return NextResponse.json({ error: pairsErr.message }, { status: 500 });
    }

    const pairs = (pairsRaw ?? []) as WaoPair[];
    const pairIds = pairs.map((p) => p.id);

    const resultsByPair = new Map<string, WaoRoundResult>();
    if (pairIds.length > 0) {
      const { data: resultsRaw, error: resultsErr } = await auth.admin
        .from("wao_round_results")
        .select("*")
        .in("pair_id", pairIds);

      if (resultsErr) {
        return NextResponse.json({ error: resultsErr.message }, { status: 500 });
      }
      for (const row of (resultsRaw ?? []) as WaoRoundResult[]) {
        resultsByPair.set(row.pair_id, row);
      }
    }

    for (const pair of pairs) {
      const result = resultsByPair.get(pair.id);
      if (!result) continue;
      const score = result.score;
      totals.set(
        pair.participant_a,
        (totals.get(pair.participant_a) ?? 0) + score
      );
      if (pair.participant_b) {
        totals.set(
          pair.participant_b,
          (totals.get(pair.participant_b) ?? 0) + score
        );
      }
    }
  }

  const participantIds = Array.from(totals.keys());
  const nameById = new Map<string, string>();

  if (participantIds.length > 0) {
    const { data: people, error: peopleErr } = await auth.admin
      .from("participants")
      .select("id, display_name")
      .in("id", participantIds);

    if (peopleErr) {
      return NextResponse.json({ error: peopleErr.message }, { status: 500 });
    }
    for (const row of people ?? []) {
      nameById.set(row.id as string, (row.display_name as string) ?? "Player");
    }
  }

  const entries: WaoScoreboardEntry[] = participantIds
    .map((id) => ({
      participantId: id,
      displayName: nameById.get(id) ?? "Player",
      totalScore: totals.get(id) ?? 0,
    }))
    .sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      return a.displayName.localeCompare(b.displayName);
    });

  return NextResponse.json({
    concurrenceRate: waoSession.concurrence_rate,
    roundsCompleted: rounds.length,
    entries,
  });
}
