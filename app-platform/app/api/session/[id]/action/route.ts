import { NextResponse } from "next/server";
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

  // Stub: actionType reserved for Phase 3 engine dispatch.

  const supabase = createClient();

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

  const nextJson = mergeJsonState(row.state_json, payload);

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
