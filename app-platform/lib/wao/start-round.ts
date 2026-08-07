/**
 * Create (or reuse) wao_session, draw a question, open a round, assign pairs.
 * Facilitator-only — call after authorizeSessionLead.
 */

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assignPairs, type PairHistory } from "./assign-pairs";
import { drawQuestion, mayDrawInactiveQuestions } from "./draw-question";
import type { WaoPair, WaoQuestion, WaoRound, WaoSession } from "@/lib/types/database";
import { WAO_ROUND_SECONDS } from "./types";

export type StartRoundSuccess = {
  ok: true;
  waoSession: WaoSession;
  round: WaoRound;
  pairCount: number;
  sitOut: string | null;
  questionId: string;
  includedInactive: boolean;
};

export type StartRoundFailure = {
  ok: false;
  status: 400 | 409 | 500;
  error: string;
};

export type StartRoundResult = StartRoundSuccess | StartRoundFailure;

export async function startWaoRound(args: {
  admin: SupabaseClient;
  sessionId: string;
  includeInactive?: boolean;
}): Promise<StartRoundResult> {
  const includeInactiveRequested = args.includeInactive === true;
  const includedInactive = mayDrawInactiveQuestions(includeInactiveRequested);

  if (includeInactiveRequested && !includedInactive) {
    return {
      ok: false,
      status: 400,
      error:
        "Inactive questions are only allowed outside production, and only when includeInactive is true.",
    };
  }

  const admin = args.admin;

  // --- wao_session -----------------------------------------------------------
  const { data: existingSession, error: sessionLookupErr } = await admin
    .from("wao_sessions")
    .select("*")
    .eq("session_id", args.sessionId)
    .maybeSingle();

  if (sessionLookupErr) {
    return { ok: false, status: 500, error: sessionLookupErr.message };
  }

  let waoSession = existingSession as WaoSession | null;

  if (!waoSession) {
    const { data: created, error: createErr } = await admin
      .from("wao_sessions")
      .insert({
        session_id: args.sessionId,
        timer_seconds: WAO_ROUND_SECONDS,
      })
      .select("*")
      .maybeSingle();

    if (createErr || !created) {
      return {
        ok: false,
        status: 500,
        error: createErr?.message ?? "Could not create WAO session.",
      };
    }
    waoSession = created as WaoSession;
  }

  // --- refuse if a round is already open ------------------------------------
  const { data: openRounds, error: openErr } = await admin
    .from("wao_rounds")
    .select("id")
    .eq("wao_session_id", waoSession.id)
    .is("locked_at", null);

  if (openErr) {
    return { ok: false, status: 500, error: openErr.message };
  }
  if ((openRounds ?? []).length > 0) {
    return {
      ok: false,
      status: 409,
      error: "A round is already in progress. Finish or lock it before starting another.",
    };
  }

  // --- prior rounds (used questions + pairing history) ----------------------
  const { data: priorRoundsRaw, error: priorErr } = await admin
    .from("wao_rounds")
    .select("*")
    .eq("wao_session_id", waoSession.id)
    .order("round_number", { ascending: true });

  if (priorErr) {
    return { ok: false, status: 500, error: priorErr.message };
  }

  const priorRounds = (priorRoundsRaw ?? []) as WaoRound[];
  const usedQuestionIds = new Set(priorRounds.map((r) => r.question_id));
  const nextRoundNumber =
    priorRounds.length === 0
      ? 1
      : Math.max(...priorRounds.map((r) => r.round_number)) + 1;

  const history: PairHistory = { pairs: [], sitOuts: [] };
  const priorDifficulties: number[] = [];

  if (priorRounds.length > 0) {
    const priorIds = priorRounds.map((r) => r.id);
    const { data: priorPairsRaw, error: pairsHistErr } = await admin
      .from("wao_pairs")
      .select("*")
      .in("round_id", priorIds);

    if (pairsHistErr) {
      return { ok: false, status: 500, error: pairsHistErr.message };
    }

    for (const pair of (priorPairsRaw ?? []) as WaoPair[]) {
      if (pair.is_solo || pair.participant_b === null) {
        history.sitOuts = [...history.sitOuts, pair.participant_a];
      } else {
        history.pairs = [
          ...history.pairs,
          [pair.participant_a, pair.participant_b],
        ];
      }
    }

    const { data: usedQuestions, error: usedQErr } = await admin
      .from("wao_questions")
      .select("id, difficulty")
      .in("id", Array.from(usedQuestionIds));

    if (usedQErr) {
      return { ok: false, status: 500, error: usedQErr.message };
    }
    for (const q of usedQuestions ?? []) {
      priorDifficulties.push(q.difficulty as number);
    }
  }

  // --- draw question --------------------------------------------------------
  const { data: library, error: libraryErr } = await admin
    .from("wao_questions")
    .select("id, pinned, active, difficulty");

  if (libraryErr) {
    return { ok: false, status: 500, error: libraryErr.message };
  }

  const drawn = drawQuestion((library ?? []) as DrawLibRow[], usedQuestionIds, {
    includeInactive: includeInactiveRequested,
    priorDifficulties,
  });

  if (!drawn) {
    return {
      ok: false,
      status: 400,
      error: includedInactive
        ? "No unused questions left in the library (including inactive)."
        : "No unused active questions left. For test draws, pass includeInactive outside production.",
    };
  }

  // --- roster ---------------------------------------------------------------
  const { data: rosterRows, error: rosterErr } = await admin
    .from("session_participants")
    .select("participant_id, joined_at")
    .eq("session_id", args.sessionId)
    .order("joined_at", { ascending: true });

  if (rosterErr) {
    return { ok: false, status: 500, error: rosterErr.message };
  }

  const roster = (rosterRows ?? []).map(
    (r) => r.participant_id as string
  );

  if (roster.length === 0) {
    return { ok: false, status: 400, error: "No participants in this session." };
  }

  const assignment = assignPairs(roster, history);
  if (!assignment.ok) {
    return { ok: false, status: 409, error: assignment.reason };
  }

  // --- create round with started_at -----------------------------------------
  const startedAt = new Date().toISOString();
  const { data: roundRaw, error: roundErr } = await admin
    .from("wao_rounds")
    .insert({
      wao_session_id: waoSession.id,
      round_number: nextRoundNumber,
      question_id: drawn.id,
      is_sample: false,
      started_at: startedAt,
    })
    .select("*")
    .maybeSingle();

  if (roundErr || !roundRaw) {
    return {
      ok: false,
      status: 500,
      error: roundErr?.message ?? "Could not create round.",
    };
  }

  const round = roundRaw as WaoRound;

  // --- write pairs ----------------------------------------------------------
  const inserts = [
    ...assignment.pairs.map((p) => ({
      round_id: round.id,
      participant_a: p.participantA,
      participant_b: p.participantB,
      is_solo: false,
    })),
    ...(assignment.sitOut
      ? [
          {
            round_id: round.id,
            participant_a: assignment.sitOut,
            participant_b: null as string | null,
            is_solo: true,
          },
        ]
      : []),
  ];

  const { error: insertPairsErr } = await admin.from("wao_pairs").insert(inserts);

  if (insertPairsErr) {
    // Best-effort rollback of the round row so a retry is clean.
    await admin.from("wao_rounds").delete().eq("id", round.id);
    return { ok: false, status: 500, error: insertPairsErr.message };
  }

  return {
    ok: true,
    waoSession,
    round,
    pairCount: assignment.pairs.length,
    sitOut: assignment.sitOut,
    questionId: drawn.id,
    includedInactive,
  };
}

type DrawLibRow = Pick<WaoQuestion, "id" | "pinned" | "active" | "difficulty">;
