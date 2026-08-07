/**
 * Build the public play-state payload for one authorized pair member.
 * Strips is_correct from items. Never call without authorizePairMember success.
 */

import "server-only";
import type { createServiceClient } from "@/lib/supabase/admin";
import type { WaoPair, WaoRound, WaoSession, WaoTap } from "@/lib/types/database";
import { perspectiveSelections, reduceTaps } from "./reduce-taps";
import { shuffleItemsForPair } from "./shuffle-items";
import type { WaoPairPlayState, WaoPublicItem } from "./types";
import { waoPairChannelName } from "./types";

type Admin = ReturnType<typeof createServiceClient>;

async function displayName(admin: Admin, participantId: string): Promise<string> {
  const { data } = await admin
    .from("participants")
    .select("display_name")
    .eq("id", participantId)
    .maybeSingle();
  return data?.display_name ?? "Player";
}

export async function buildPairPlayState(args: {
  admin: Admin;
  participantId: string;
  pair: WaoPair;
  round: WaoRound;
  waoSession: WaoSession;
}): Promise<{ ok: true; state: WaoPairPlayState } | { ok: false; error: string }> {
  const { pair, round, waoSession, participantId, admin } = args;

  const { data: question, error: questionErr } = await admin
    .from("wao_questions")
    .select("id, category_title, disambiguation_rule, disambiguation_detail")
    .eq("id", round.question_id)
    .maybeSingle();

  if (questionErr || !question) {
    return { ok: false, error: questionErr?.message ?? "Question not found." };
  }

  const { data: itemRows, error: itemsErr } = await admin
    .from("wao_question_items")
    .select("id, label")
    .eq("question_id", round.question_id);

  if (itemsErr) {
    return { ok: false, error: itemsErr.message };
  }

  const items: WaoPublicItem[] = shuffleItemsForPair(
    (itemRows ?? []).map((row) => ({
      id: row.id,
      label: row.label,
    })),
    pair.id
  );

  const { data: tapRows, error: tapsErr } = await admin
    .from("wao_taps")
    .select("id, pair_id, participant_id, item_id, action, client_seq, created_at")
    .eq("pair_id", pair.id);

  if (tapsErr) {
    return { ok: false, error: tapsErr.message };
  }

  const taps = (tapRows ?? []) as WaoTap[];
  const sets = reduceTaps(taps, pair.participant_a, pair.participant_b);
  const perspective = perspectiveSelections(
    sets,
    pair.participant_a,
    pair.participant_b,
    participantId
  );

  const partnerId =
    participantId === pair.participant_a
      ? pair.participant_b
      : pair.participant_a;

  const myDisplayName = await displayName(admin, participantId);
  const partnerDisplayName =
    partnerId !== null ? await displayName(admin, partnerId) : null;

  const state: WaoPairPlayState = {
    pairId: pair.id,
    roundId: round.id,
    sessionId: waoSession.session_id,
    waoSessionId: waoSession.id,
    questionId: question.id,
    categoryTitle: question.category_title,
    disambiguationRule: question.disambiguation_rule,
    disambiguationDetail: question.disambiguation_detail,
    timerSeconds: waoSession.timer_seconds,
    startedAt: round.started_at,
    lockedAt: round.locked_at,
    lockReason: round.lock_reason,
    isSolo: pair.is_solo,
    participantA: pair.participant_a,
    participantB: pair.participant_b,
    myParticipantId: participantId,
    partnerParticipantId: partnerId,
    myDisplayName,
    partnerDisplayName,
    items,
    selectionMine: perspective.selectionMine,
    selectionTheirs: perspective.selectionTheirs,
    channel: waoPairChannelName(round.id, pair.id),
  };

  return { ok: true, state };
}
