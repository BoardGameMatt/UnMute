import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PARTICIPANT_COOKIE } from "@/lib/constants";
import {
  clientPayloadToEngineAction as dibeClientPayloadToEngineAction,
  dibeExpiryDelayMs,
  reduceDrawItByEarState,
} from "@/lib/protocols/draw-it-by-ear/engine";
import {
  drawItByEarStateToJson,
  isDrawItByEarState,
} from "@/lib/protocols/draw-it-by-ear/types";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
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
  generation?: unknown;
  operationId?: unknown;
  context?: unknown;
};

/**
 * Actions that advance the session for everyone. Hiding the button client-side
 * is not enough — the role is verified against session_participants here.
 */
const DIBE_LEAD_ONLY_ACTIONS = new Set([
  "everyoneBack",
  "skipShowDrawings",
  "leadStartBreakoutRound",
  "leadAdvanceTimedPhase",
  "leadEndDrawingForAllRooms",
]);

type ProtocolSlugRow = { slug: string };
// A supported room has up to 20 simultaneous writers. Allow every writer a
// chance to rebase even under an adversarial ordering, while remaining bounded.
const DIBE_WRITE_ATTEMPTS = 25;

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
  if (parsed.operationId !== undefined && (typeof parsed.operationId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed.operationId))) return NextResponse.json({ error: "Invalid operation ID." }, { status: 400 });

  const supabase = createClient();

  const { data: sessionRow, error: sessionErr } = await supabase
    .from("sessions")
    .select("id, status, lifecycle_version, protocols ( slug )")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionErr) {
    return NextResponse.json({ error: sessionErr.message }, { status: 500 });
  }

  if (parsed.generation !== undefined && (!Number.isSafeInteger(parsed.generation) ||
    parsed.generation !== sessionRow?.lifecycle_version || sessionRow?.status !== "active")) {
    return NextResponse.json({ error: "This input belongs to a workshop that has changed. Refresh before continuing." }, { status: 409 });
  }
  const generation = sessionRow?.lifecycle_version;

  const protocolRaw = sessionRow?.protocols;
  const protocolRow = Array.isArray(protocolRaw) ? protocolRaw[0] : protocolRaw;
  const protocolSlug =
    protocolRow && typeof protocolRow === "object" && "slug" in protocolRow
      ? (protocolRow as ProtocolSlugRow).slug
      : "";

  const { data: initialRow, error: fetchError } = await supabase
    .from("session_state")
    .select("id, state_json, revision")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!initialRow) {
    return NextResponse.json({ error: "session_state not found" }, { status: 404 });
  }

  if (protocolSlug === "draw-it-by-ear") {
    const requesterId = cookies().get(PARTICIPANT_COOKIE)?.value || (typeof payloadRecord.participantId === "string" ? payloadRecord.participantId : "");
    if (DIBE_LEAD_ONLY_ACTIONS.has(actionType)) {
      const participantIdFromPayload =
        typeof payloadRecord.participantId === "string"
          ? payloadRecord.participantId
          : "";
      const requesterId =
        cookies().get(PARTICIPANT_COOKIE)?.value || participantIdFromPayload;

      if (!requesterId) {
        return NextResponse.json(
          { error: "Could not identify participant." },
          { status: 401 }
        );
      }

      const { data: membership, error: membershipErr } = await supabase
        .from("session_participants")
        .select("role_in_session")
        .eq("session_id", sessionId)
        .eq("participant_id", requesterId)
        .maybeSingle();

      if (membershipErr) {
        return NextResponse.json({ error: membershipErr.message }, { status: 500 });
      }

      if (membership?.role_in_session !== "lead") {
        return NextResponse.json(
          { error: "Only the session lead can advance this phase." },
          { status: 403 }
        );
      }
    }

    const operationId = typeof parsed.operationId === "string" ? parsed.operationId : null;
    const fingerprint = { actionType, payload: payloadRecord };
    if (operationId) {
      const receipt = await createServiceClient().rpc("lookup_workshop_receipt", { p_session_id: sessionId, p_generation: generation,
        p_actor_id: requesterId, p_operation_id: operationId, p_payload: fingerprint });
      if (receipt.error) return NextResponse.json({ error: receipt.error.message }, { status: receipt.error.code === "40001" ? 409 : 500 });
      if (receipt.data === true) return NextResponse.json({ ok: true, changed: true, deduped: true });
    }
    try {
      let row = initialRow;
      for (let attempt = 0; attempt < DIBE_WRITE_ATTEMPTS; attempt++) {
        if (attempt > 0 && generation !== undefined) {
          const { data: lifecycle, error } = await supabase.from("sessions").select("status, lifecycle_version")
            .eq("id", sessionId).maybeSingle();
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
          if (!lifecycle || lifecycle.lifecycle_version !== generation || lifecycle.status !== "active") {
            return NextResponse.json({ error: "The workshop changed while this input was waiting." }, { status: 409 });
          }
        }

        if (actionType === "initializeGame" && isDrawItByEarState(row.state_json)) {
          return NextResponse.json({ ok: true, skipped: true });
        }

        const engineAction = dibeClientPayloadToEngineAction(actionType, payloadRecord);
        const prior = isDrawItByEarState(row.state_json) ? row.state_json : null;
        if (prior && actionType === "submitScoring") {
          if (payloadRecord.armedPhase !== undefined && (payloadRecord.armedPhase !== prior.phase || payloadRecord.timerStartedAt !== prior.timer_started_at)) {
            return NextResponse.json({ error: "That scoring window has ended." }, { status: 409 });
          }
          const start = Date.parse(prior.timer_started_at ?? "");
          if (Number.isFinite(start) && prior.timer_duration_seconds > 0 && Date.now() >= start + prior.timer_duration_seconds * 1000) {
            return NextResponse.json({ error: "The scoring deadline has passed." }, { status: 409 });
          }
        }
        if (prior && actionType !== "initializeGame" && parsed.context && typeof parsed.context === "object") {
          const context = parsed.context as Record<string, unknown>;
          if (context.phase !== prior.phase || context.round !== prior.current_round || context.timer !== prior.timer_started_at) return NextResponse.json({ error: "This action belongs to a previous phase or round." }, { status: 409 });
        }
        const expiryDelay = prior ? dibeExpiryDelayMs(prior, actionType, payloadRecord) : 0;
        if (expiryDelay === null || expiryDelay > 0) {
          return NextResponse.json({ ok: true, changed: false, retryAfterMs: expiryDelay ?? 0 });
        }
        const nextState = reduceDrawItByEarState(prior, engineAction);

        // Guards no-op by returning the same object. Report that back so lead
        // override controls can tell the caller nothing happened.
        const changed = nextState !== prior;
        if (!changed) return NextResponse.json({ ok: true, changed: false });

        const expectedRevision = prior?.write_revision ?? null;
        let committed: unknown = null;
        let updateError: { code?: string; message: string } | null = null;
        if (operationId) {
          const result = await createServiceClient().rpc("commit_dibe_snapshot", { p_session_id: sessionId, p_generation: generation,
            p_revision: row.revision, p_actor_id: requesterId, p_operation_id: operationId, p_payload: fingerprint,
            p_state: drawItByEarStateToJson({ ...nextState, write_revision: (expectedRevision ?? 0) + 1,
              ...(actionType === "endSession" ? { completion_requested: true } : {}),
              ...(actionType === "submitScoring" ? { scoring_admission: { phase: prior?.phase, timer: prior?.timer_started_at, operation: crypto.randomUUID() } } : {}) }) });
          updateError = result.error;
          committed = result.data?.conflict ? null : result.data;
        } else {
          let write = supabase
          .from("session_state")
          .update({
            state_json: drawItByEarStateToJson({ ...nextState, write_revision: (expectedRevision ?? 0) + 1, ...(actionType === "endSession" ? { completion_requested: true } : {}),
              ...(actionType === "submitScoring" ? { scoring_admission: { phase: prior?.phase, timer: prior?.timer_started_at, operation: crypto.randomUUID() } } : {}) }),
            phase: nextState.phase,
            current_round: nextState.total_rounds_played,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id).eq("revision", row.revision);
        // Keep the filter small even when the game snapshot includes a large
        // image catalog. Missing revisions bootstrap existing sessions safely.
        write = expectedRevision === null
          ? write.is("state_json->>write_revision", null)
          : write.eq("state_json->>write_revision", String(expectedRevision));
        const result = await write
          .select("id")
          .maybeSingle();

          committed = result.data; updateError = result.error;
        }

        if (updateError) {
          if (updateError.code === "40P01" || updateError.code === "40001") {
            return NextResponse.json({ error: "The workshop changed. Retry your input." }, { status: 409 });
          }
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }
        if (!committed) {
          const { data: fresh, error: reloadError } = await supabase
            .from("session_state")
            .select("id, state_json, revision")
            .eq("session_id", sessionId)
            .maybeSingle();
          if (reloadError) return NextResponse.json({ error: reloadError.message }, { status: 500 });
          if (!fresh) return NextResponse.json({ error: "Session state not found." }, { status: 404 });
          row = fresh;
          continue;
        }

        return NextResponse.json({ ok: true, changed });
      }
      return NextResponse.json({ error: "The room is updating. Please try again." }, { status: 409 });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Engine error";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const nextJson = mergeJsonState(initialRow.state_json, payloadRecord);

  const { data: saved, error: updateError } = await supabase
    .from("session_state")
    .update({
      state_json: nextJson,
      updated_at: new Date().toISOString(),
    })
    .eq("id", initialRow.id).eq("revision", initialRow.revision)
    .select("id").maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (!saved) return NextResponse.json({ error: "The workshop changed. Please retry your input." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
