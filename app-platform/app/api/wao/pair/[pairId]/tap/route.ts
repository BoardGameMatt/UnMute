import { NextResponse } from "next/server";
import { authorizePairMember } from "@/lib/wao/authorize-pair";
import { broadcastPairEvent } from "@/lib/wao/broadcast";
import { reduceTaps } from "@/lib/wao/reduce-taps";
import type { WaoTap, WaoTapAction } from "@/lib/types/database";

type RouteContext = { params: { pairId: string } };

type TapBody = {
  itemId?: unknown;
  action?: unknown;
  clientSeq?: unknown;
};

/**
 * Append one tap to wao_taps. Server timestamps only.
 * client_seq is required for UNIQUE (pair_id, participant_id, client_seq) retry dedupe.
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

  if (auth.round.locked_at) {
    return NextResponse.json({ error: "Round is already locked." }, { status: 409 });
  }

  const myLocked =
    auth.participantId === auth.pair.participant_a
      ? auth.pair.locked_a_at
      : auth.pair.locked_b_at;
  if (myLocked) {
    return NextResponse.json(
      { error: "You have already locked in." },
      { status: 409 }
    );
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

  const { data: inserted, error: insertErr } = await auth.admin
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

  if (insertErr) {
    if (insertErr.code === "23505") {
      const { data: existing } = await auth.admin
        .from("wao_taps")
        .select("id, pair_id, participant_id, item_id, action, client_seq, created_at")
        .eq("pair_id", auth.pair.id)
        .eq("participant_id", auth.participantId)
        .eq("client_seq", clientSeq)
        .maybeSingle();

      const { data: allTaps } = await auth.admin
        .from("wao_taps")
        .select("id, pair_id, participant_id, item_id, action, client_seq, created_at")
        .eq("pair_id", auth.pair.id);

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
    deduped: false,
    tap,
    selectionA: sets.selectionA,
    selectionB: sets.selectionB,
  });
}
