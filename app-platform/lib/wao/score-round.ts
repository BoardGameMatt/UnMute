/**
 * Persist pair scores after a round locks. Idempotent under double-close.
 */

import "server-only";
import type { createServiceClient } from "@/lib/supabase/admin";
import type { WaoPair, WaoRound, WaoSession, WaoTap } from "@/lib/types/database";
import { reduceTaps } from "./reduce-taps";
import { scorePair } from "./score-pair";

type Admin = ReturnType<typeof createServiceClient>;

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

/**
 * Score every pair in a locked round. Safe to call repeatedly:
 * UNIQUE (pair_id) conflicts are treated as already-scored, not errors.
 * Session concurrence counters are recomputed from stored results.
 */
export async function ensureRoundScored(args: {
  admin: Admin;
  round: WaoRound;
  waoSession: WaoSession;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { admin, round, waoSession } = args;

  if (!round.locked_at) {
    return { ok: false, error: "Round is not locked yet." };
  }

  const { data: itemRows, error: itemsErr } = await admin
    .from("wao_question_items")
    .select("id, is_correct")
    .eq("question_id", round.question_id);

  if (itemsErr) {
    return { ok: false, error: itemsErr.message };
  }

  const correctItemIds = (itemRows ?? [])
    .filter((row) => row.is_correct === true)
    .map((row) => row.id as string);

  const { data: pairRows, error: pairsErr } = await admin
    .from("wao_pairs")
    .select("*")
    .eq("round_id", round.id);

  if (pairsErr) {
    return { ok: false, error: pairsErr.message };
  }

  const pairs = (pairRows ?? []) as WaoPair[];

  for (const pair of pairs) {
    const { data: existing, error: existingErr } = await admin
      .from("wao_round_results")
      .select("id")
      .eq("pair_id", pair.id)
      .maybeSingle();

    if (existingErr) {
      return { ok: false, error: existingErr.message };
    }
    if (existing) continue;

    const { data: tapRows, error: tapsErr } = await admin
      .from("wao_taps")
      .select("id, pair_id, participant_id, item_id, action, client_seq, created_at")
      .eq("pair_id", pair.id);

    if (tapsErr) {
      return { ok: false, error: tapsErr.message };
    }

    const sets = reduceTaps(
      (tapRows ?? []) as WaoTap[],
      pair.participant_a,
      pair.participant_b
    );

    const outcome = scorePair({
      selectionA: sets.selectionA,
      selectionB: sets.selectionB,
      isSolo: pair.is_solo,
      correctItemIds,
      participantA: pair.participant_a,
      participantB: pair.participant_b,
    });

    const { error: insertErr } = await admin.from("wao_round_results").insert({
      pair_id: pair.id,
      submitted_item_ids: outcome.submittedItemIds,
      score: outcome.score,
      bonus: outcome.bonus,
      lott: outcome.lott,
      had_save: outcome.hadSave,
      saver_participant_id: outcome.saverParticipantId,
      exact_match: outcome.exactMatch,
    });

    if (insertErr) {
      if (isUniqueViolation(insertErr)) {
        // Another close-timer raced us; row is already authoritative.
        continue;
      }
      return { ok: false, error: insertErr.message };
    }
  }

  const refreshed = await refreshSessionConcurrence(admin, waoSession.id);
  if (!refreshed.ok) return refreshed;

  return { ok: true };
}

/**
 * Recompute concurrence from all non-solo pair results in this WAO session.
 * Idempotent — safe after unique-conflict skips.
 */
export async function refreshSessionConcurrence(
  admin: Admin,
  waoSessionId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: rounds, error: roundsErr } = await admin
    .from("wao_rounds")
    .select("id")
    .eq("wao_session_id", waoSessionId);

  if (roundsErr) {
    return { ok: false, error: roundsErr.message };
  }

  const roundIds = (rounds ?? []).map((r) => r.id as string);
  if (roundIds.length === 0) {
    const { error } = await admin
      .from("wao_sessions")
      .update({
        paired_round_count: 0,
        exact_match_round_count: 0,
        concurrence_rate: null,
      })
      .eq("id", waoSessionId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  const { data: pairs, error: pairsErr } = await admin
    .from("wao_pairs")
    .select("id, is_solo")
    .in("round_id", roundIds);

  if (pairsErr) {
    return { ok: false, error: pairsErr.message };
  }

  const pairedIds = ((pairs ?? []) as Pick<WaoPair, "id" | "is_solo">[])
    .filter((p) => !p.is_solo)
    .map((p) => p.id);

  if (pairedIds.length === 0) {
    const { error } = await admin
      .from("wao_sessions")
      .update({
        paired_round_count: 0,
        exact_match_round_count: 0,
        concurrence_rate: null,
      })
      .eq("id", waoSessionId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  const { data: results, error: resultsErr } = await admin
    .from("wao_round_results")
    .select("pair_id, exact_match")
    .in("pair_id", pairedIds);

  if (resultsErr) {
    return { ok: false, error: resultsErr.message };
  }

  const rows = results ?? [];
  const pairedRoundCount = rows.length;
  const exactMatchRoundCount = rows.filter((r) => r.exact_match === true).length;
  const concurrenceRate =
    pairedRoundCount === 0
      ? null
      : Math.round((exactMatchRoundCount / pairedRoundCount) * 10000) / 100;

  const { error: updateErr } = await admin
    .from("wao_sessions")
    .update({
      paired_round_count: pairedRoundCount,
      exact_match_round_count: exactMatchRoundCount,
      concurrence_rate: concurrenceRate,
    })
    .eq("id", waoSessionId);

  if (updateErr) {
    return { ok: false, error: updateErr.message };
  }

  return { ok: true };
}
