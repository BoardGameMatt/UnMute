import { NextResponse } from "next/server";
import { PARTICIPANT_COOKIE } from "@/lib/constants";
import {
  canRevealImageToEveryone,
  isDescriberForActiveRound,
} from "@/lib/protocols/draw-it-by-ear/engine";
import { isDrawItByEarState } from "@/lib/protocols/draw-it-by-ear/types";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

const STORAGE_BUCKET = "DrawItByEarImages";
const SIGNED_URL_TTL_SEC = 600;

type RouteContext = {
  params: { sessionId: string } | Promise<{ sessionId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const resolved = await Promise.resolve(context.params);
  const sessionId = resolved.sessionId;

  const url = new URL(request.url);
  const participantIdParam = url.searchParams.get("participantId")?.trim();
  const cookieStore = cookies();
  const participantId =
    participantIdParam || cookieStore.get(PARTICIPANT_COOKIE)?.value || "";

  if (!sessionId || !participantId) {
    return NextResponse.json(
      { error: "Missing session or participant." },
      { status: 400 }
    );
  }

  const supabase = createClient();
  const { data: membership, error: memberErr } = await supabase
    .from("session_participants")
    .select("id")
    .eq("session_id", sessionId)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (memberErr || !membership) {
    return NextResponse.json({ error: "Not a session participant." }, { status: 403 });
  }

  const { data: stateRow, error: stateErr } = await supabase
    .from("session_state")
    .select("state_json")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (stateErr || !stateRow) {
    return NextResponse.json({ error: "Session state not found." }, { status: 404 });
  }

  if (!isDrawItByEarState(stateRow.state_json)) {
    return NextResponse.json({ error: "Invalid protocol state." }, { status: 400 });
  }

  const state = stateRow.state_json;
  const mayView =
    canRevealImageToEveryone(state) ||
    isDescriberForActiveRound(state, participantId);

  if (!mayView || !state.active_image_id) {
    return NextResponse.json({ error: "Image not available for your role." }, { status: 403 });
  }

  const { data: imageRow, error: imageErr } = await supabase
    .from("protocol_images")
    .select("image_path, name")
    .eq("id", state.active_image_id)
    .maybeSingle();

  if (imageErr || !imageRow?.image_path) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }

  try {
    const service = createServiceClient();
    const { data: signed, error: signErr } = await service.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(imageRow.image_path, SIGNED_URL_TTL_SEC);

    if (signErr || !signed?.signedUrl) {
      return NextResponse.json(
        { error: signErr?.message ?? "Could not sign image URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signedUrl: signed.signedUrl,
      name: imageRow.name,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server configuration error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
