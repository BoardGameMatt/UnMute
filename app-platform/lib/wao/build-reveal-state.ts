/**
 * Reveal payload for one authorized pair member after the round is locked
 * and scored. Loads is_correct only here — never from build-pair-state.
 */

import "server-only";
import type { createServiceClient } from "@/lib/supabase/admin";
import type {
  WaoPair,
  WaoRound,
  WaoRoundResult,
  WaoSession,
  WaoTap,
} from "@/lib/types/database";
import type { WaoRevealState } from "./types";
import { perspectiveSelections, reduceTaps } from "./reduce-taps";
import { buildRevealBuckets } from "./score-pair";
import { ensureRoundScored } from "./score-round";

type Admin = ReturnType<typeof createServiceClient>;

async function displayName(admin: Admin, participantId: string): Promise<string> {
  const { data } = await admin
    .from("participants")
    .select("display_name")
    .eq("id", participantId)
    .maybeSingle();
  return data?.display_name ?? "Player";
}

export async function buildPairRevealState(args: {
  admin: Admin;
  participantId: string;
  pair: WaoPair;
  round: WaoRound;
  waoSession: WaoSession;
}): Promise<{ ok: true; state: WaoRevealState } | { ok: false; error: string; status: number }> {
  const { admin, participantId, pair, round, waoSession } = args;

  if (!round.locked_at) {
    return { ok: false, status: 409, error: "Round is not locked yet." };
  }

  const scored = await ensureRoundScored({ admin, round, waoSession });
  if (!scored.ok) {
    return { ok: false, status: 500, error: scored.error };
  }

  const { data: resultRaw, error: resultErr } = await admin
    .from("wao_round_results")
    .select("*")
    .eq("pair_id", pair.id)
    .maybeSingle();

  if (resultErr) {
    return { ok: false, status: 500, error: resultErr.message };
  }
  if (!resultRaw) {
    return { ok: false, status: 500, error: "Round result missing after scoring." };
  }

  const result = resultRaw as WaoRoundResult;

  const { data: question, error: questionErr } = await admin
    .from("wao_questions")
    .select("id, category_title, disambiguation_rule, disambiguation_detail")
    .eq("id", round.question_id)
    .maybeSingle();

  if (questionErr || !question) {
    return {
      ok: false,
      status: 500,
      error: questionErr?.message ?? "Question not found.",
    };
  }

  // Reveal-only: is_correct is allowed after lock + score.
  const { data: itemRows, error: itemsErr } = await admin
    .from("wao_question_items")
    .select("id, label, is_correct")
    .eq("question_id", round.question_id)
    .order("label", { ascending: true });

  if (itemsErr) {
    return { ok: false, status: 500, error: itemsErr.message };
  }

  const items = (itemRows ?? []).map((row) => ({
    id: row.id as string,
    label: row.label as string,
    isCorrect: row.is_correct === true,
  }));

  const { data: tapRows, error: tapsErr } = await admin
    .from("wao_taps")
    .select("id, pair_id, participant_id, item_id, action, client_seq, created_at")
    .eq("pair_id", pair.id);

  if (tapsErr) {
    return { ok: false, status: 500, error: tapsErr.message };
  }

  const sets = reduceTaps(
    (tapRows ?? []) as WaoTap[],
    pair.participant_a,
    pair.participant_b
  );
  const perspective = perspectiveSelections(
    sets,
    pair.participant_a,
    pair.participant_b,
    participantId
  );

  const buckets = buildRevealBuckets({
    selectionMine: perspective.selectionMine,
    selectionTheirs: perspective.selectionTheirs,
    isSolo: pair.is_solo,
    items,
  });

  const partnerId =
    participantId === pair.participant_a
      ? pair.participant_b
      : pair.participant_a;

  const myDisplayName = await displayName(admin, participantId);
  const partnerDisplayName =
    partnerId !== null ? await displayName(admin, partnerId) : null;

  const state: WaoRevealState = {
    pairId: pair.id,
    roundId: round.id,
    sessionId: waoSession.session_id,
    categoryTitle: question.category_title,
    disambiguationRule: question.disambiguation_rule,
    disambiguationDetail: question.disambiguation_detail,
    isSolo: pair.is_solo,
    myDisplayName,
    partnerDisplayName,
    score: result.score,
    bonus: result.bonus,
    lott: result.lott,
    hadSave: result.had_save,
    exactMatch: result.exact_match,
    submittedItemIds: result.submitted_item_ids,
    buckets,
  };

  return { ok: true, state };
}
