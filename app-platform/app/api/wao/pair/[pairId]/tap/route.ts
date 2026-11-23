import { NextResponse } from "next/server";
import { authorizePairMember } from "@/lib/wao/authorize-pair";
import { broadcastPairEvent } from "@/lib/wao/broadcast";
import { reduceTaps } from "@/lib/wao/reduce-taps";
import { WAO_SETTLE_SECONDS } from "@/lib/wao/types";
import type { WaoTap, WaoTapAction } from "@/lib/types/database";

type RouteContext = { params: { pairId: string } };

type TapBody = {
  itemId?: unknown;
  action?: unknown;
  clientSeq?: unknown;
  operationId?: unknown;
};

/**
 * Append one tap to wao_taps. Server timestamps only.
 * client_seq is required for UNIQUE (pair_id, participant_id, client_seq) retry dedupe.
 * Round ends only via timer; taps are rejected once the round is locked.
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await authorizePairMember(context.params.pairId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: TapBody;
  try {
    body = (await request.json()) as TapBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const itemId = body.itemId;
  const action = body.action;
  const clientSeq = body.clientSeq;

  if (typeof itemId !== "string" || itemId.length === 0) {
    return NextResponse.json({ error: "itemId is required." }, { status: 400 });
  }
  if (action !== "select" && action !== "deselect") {
    return NextResponse.json(
      { error: "action must be select or deselect." },
      { status: 400 }
    );
  }
  if (typeof clientSeq !== "number" || !Number.isInteger(clientSeq) || clientSeq < 0) {
    return NextResponse.json(
      { error: "clientSeq must be a non-negative integer." },
      { status: 400 }
    );
  }

  if (body.operationId !== undefined && (typeof body.operationId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.operationId))) return NextResponse.json({ error: "Invalid operation ID." }, { status: 400 });

  if (auth.round.locked_at) {
    return NextResponse.json({ error: "Round is already locked." }, { status: 409 });
  }
  const startedMs = Date.parse(auth.round.started_at ?? "");
  const cutoffMs = startedMs + (auth.waoSession.timer_seconds + WAO_SETTLE_SECONDS) * 1000;
  if (!Number.isFinite(cutoffMs) || Date.now() >= cutoffMs) {
    return NextResponse.json({ error: "The round's input window has ended." }, { status: 409 });
  }

  const { data: item, error: itemErr } = await auth.admin
    .from("wao_question_items")
    .select("id")
    .eq("id", itemId)
    .eq("question_id", auth.round.question_id)
    .maybeSingle();

  if (itemErr) {
    return NextResponse.json({ error: itemErr.message }, { status: 500 });
  }
  if (!item) {
    return NextResponse.json({ error: "Item is not part of this question." }, { status: 400 });
  }

  let inserted: WaoTap | null = null;
  let insertErr: { code?: string; message: string } | null = null;
  let wasDeduped = false;
  if (typeof body.operationId === "string") {
    const result = await auth.admin.rpc("record_wao_tap", { p_pair_id: auth.pair.id, p_actor_id: auth.participantId,
      p_item_id: itemId, p_action: action, p_client_seq: clientSeq, p_operation_id: body.operationId });
    insertErr = result.error;
    if (result.data) { inserted = result.data.tap as WaoTap; wasDeduped = result.data.deduped === true; }
  } else {
    const result = await auth.admin
    .from("wao_taps")
    .insert({
      pair_id: auth.pair.id,
      participant_id: auth.participantId,
      item_id: itemId,
      action: action as WaoTapAction,
      client_seq: clientSeq,
    })
    .select("id, pair_id, participant_id, item_id, action, client_seq, created_at")
    .maybeSingle();
    inserted = result.data as WaoTap | null; insertErr = result.error;
  }

  if (insertErr) {
    if (insertErr.code === "40001" || insertErr.code === "40P01") return NextResponse.json({ error: "The round input window changed. Refresh the pair state." }, { status: 409 });
    if (insertErr.code === "23505") {
      const { data: existing, error: existingErr } = await auth.admin
        .from("wao_taps")
        .select("id, pair_id, participant_id, item_id, action, client_seq, created_at")
        .eq("pair_id", auth.pair.id)
        .eq("participant_id", auth.participantId)
        .eq("client_seq", clientSeq)
        .maybeSingle();
      if (existingErr || !existing) {
        return NextResponse.json({ error: existingErr?.message ?? "Could not verify the prior tap." }, { status: 500 });
      }
      if (existing.item_id !== itemId || existing.action !== action) {
        return NextResponse.json({ error: "This tap sequence was already used for a different action. Refresh the pair state and try again." }, { status: 409 });
      }

      const { data: allTaps, error: allTapsErr } = await auth.admin
        .from("wao_taps")
        .select("id, pair_id, participant_id, item_id, action, client_seq, created_at")
        .eq("pair_id", auth.pair.id);
      if (allTapsErr) return NextResponse.json({ error: allTapsErr.message }, { status: 500 });

      const sets = reduceTaps(
        (allTaps ?? []) as WaoTap[],
        auth.pair.participant_a,
        auth.pair.participant_b
      );

      return NextResponse.json({
        ok: true,
        deduped: true,
        tap: existing,
        selectionA: sets.selectionA,
        selectionB: sets.selectionB,
      });
    }
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  const { data: allTaps, error: tapsErr } = await auth.admin
    .from("wao_taps")
    .select("id, pair_id, participant_id, item_id, action, client_seq, created_at")
    .eq("pair_id", auth.pair.id);

  if (tapsErr) {
    return NextResponse.json({ error: tapsErr.message }, { status: 500 });
  }

  if (!inserted) {
    return NextResponse.json({ error: "Tap insert returned no row." }, { status: 500 });
  }

  const sets = reduceTaps(
    (allTaps ?? []) as WaoTap[],
    auth.pair.participant_a,
    auth.pair.participant_b
  );

  const tap = inserted as WaoTap;

  await broadcastPairEvent(auth.admin, auth.round.id, auth.pair.id, {
    type: "tap",
    pairId: auth.pair.id,
    tap: {
      participantId: tap.participant_id,
      itemId: tap.item_id,
      action: tap.action,
      clientSeq: tap.client_seq,
      createdAt: tap.created_at,
    },
    selectionA: sets.selectionA,
    selectionB: sets.selectionB,
  });

  return NextResponse.json({
    ok: true,
    deduped: wasDeduped,
    tap,
    selectionA: sets.selectionA,
    selectionB: sets.selectionB,
  });
}
