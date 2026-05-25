import { NextResponse } from "next/server";
import {
  clientPayloadToEngineAction as dibeClientPayloadToEngineAction,
  reduceDrawItByEarState,
} from "@/lib/protocols/draw-it-by-ear/engine";
import {
  drawItByEarStateToJson,
  isDrawItByEarState,
} from "@/lib/protocols/draw-it-by-ear/types";
import {
  clientPayloadToEngineAction,
  reduceTruthIsState,
} from "@/lib/protocols/the-truth-is/engine";
import {
  isTruthIsState,
  truthIsStateToJson,
} from "@/lib/protocols/the-truth-is/types";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/database";

function mergeJsonState(current: Json, patch: object): Json {
  const base =
    current !== null &&
    typeof current === "object" &&
    !Array.isArray(current)
      ? { ...(current as Record<string, Json>) }
      : {};
  const extra =
    patch !== null &&
    typeof patch === "object" &&
    !Array.isArray(patch)
      ? (patch as Record<string, Json>)
      : {};
  return { ...base, ...extra };
}

type ActionBody = {
  actionType?: unknown;
  payload?: unknown;
};

type ProtocolSlugRow = { slug: string };

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const sessionId = params.id;

  let parsed: ActionBody;
  try {
    parsed = (await req.json()) as ActionBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const actionType = parsed.actionType;
  const payload = parsed.payload;

  if (typeof actionType !== "string") {
    return NextResponse.json(
      { error: "Expected actionType: string" },
      { status: 400 }
    );
  }

  if (
    payload === undefined ||
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return NextResponse.json(
      { error: "Expected payload: object" },
      { status: 400 }
    );
  }

  const payloadRecord = payload as Record<string, unknown>;

  const supabase = createClient();

  const { data: sessionRow, error: sessionErr } = await supabase
    .from("sessions")
    .select("id, protocols ( slug )")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionErr) {
    return NextResponse.json({ error: sessionErr.message }, { status: 500 });
  }

  const protocolRaw = sessionRow?.protocols;
  const protocolRow = Array.isArray(protocolRaw) ? protocolRaw[0] : protocolRaw;
  const protocolSlug =
    protocolRow && typeof protocolRow === "object" && "slug" in protocolRow
      ? (protocolRow as ProtocolSlugRow).slug
      : "";

  const { data: row, error: fetchError } = await supabase
    .from("session_state")
    .select("id, state_json")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ error: "session_state not found" }, { status: 404 });
  }

  if (protocolSlug === "draw-it-by-ear") {
    try {
      if (actionType === "initializeGame" && isDrawItByEarState(row.state_json)) {
        return NextResponse.json({ ok: true, skipped: true });
      }

      const engineAction = dibeClientPayloadToEngineAction(actionType, payloadRecord);
      const prior = isDrawItByEarState(row.state_json) ? row.state_json : null;
      const nextState = reduceDrawItByEarState(prior, engineAction);

      const { error: updateError } = await supabase
        .from("session_state")
        .update({
          state_json: drawItByEarStateToJson(nextState),
          phase: nextState.phase,
          current_round: nextState.total_rounds_played,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      if (actionType === "lockTeams" && nextState.teams_locked) {
        await supabase.from("dibe_teams").delete().eq("session_id", sessionId);
        const teamRows = nextState.teams.map((team) => ({
          session_id: sessionId,
          name: team.name,
          color: team.color,
          member_ids: team.member_ids,
          describer_rotation: team.describer_rotation,
          current_describer_index: team.current_describer_index,
          cumulative_score: team.cumulative_score,
        }));
        if (teamRows.length > 0) {
          const { error: teamsErr } = await supabase.from("dibe_teams").insert(teamRows);
          if (teamsErr) {
            return NextResponse.json({ error: teamsErr.message }, { status: 500 });
          }
        }
      }

      if (actionType === "endSession") {
        const completedAt = new Date().toISOString();
        const { error: sessionUpdateErr } = await supabase
          .from("sessions")
          .update({
            status: "completed",
            completed_at: completedAt,
          })
          .eq("id", sessionId);

        if (sessionUpdateErr) {
          return NextResponse.json({ error: sessionUpdateErr.message }, { status: 500 });
        }
      }

      return NextResponse.json({ ok: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Engine error";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  if (protocolSlug === "the-truth-is") {
    try {
      if (actionType === "initializeGame" && isTruthIsState(row.state_json)) {
        return NextResponse.json({ ok: true, skipped: true });
      }

      const engineAction = clientPayloadToEngineAction(actionType, payloadRecord);
      const prior = isTruthIsState(row.state_json) ? row.state_json : null;
      const nextState = reduceTruthIsState(prior, engineAction);

      const { error: updateError } = await supabase
        .from("session_state")
        .update({
          state_json: truthIsStateToJson(nextState),
          phase: nextState.phase,
          current_round: nextState.total_rounds_played,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      if (actionType === "endSession") {
        const completedAt = new Date().toISOString();
        const { error: sessionUpdateErr } = await supabase
          .from("sessions")
          .update({
            status: "completed",
            completed_at: completedAt,
          })
          .eq("id", sessionId);

        if (sessionUpdateErr) {
          return NextResponse.json({ error: sessionUpdateErr.message }, { status: 500 });
        }
      }

      return NextResponse.json({ ok: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Engine error";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const nextJson = mergeJsonState(row.state_json, payloadRecord);

  const { error: updateError } = await supabase
    .from("session_state")
    .update({
      state_json: nextJson,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
