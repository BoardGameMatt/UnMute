import { NextResponse } from "next/server";
import {
  JOIN_CODE_LENGTH,
  normalizeDisplayName,
  normalizeJoinCode,
} from "@/lib/constants";
import { redirectSameOrigin } from "@/lib/http/redirect-same-origin";
import { joinSessionAsGuestCore } from "@/lib/join/join-session-as-guest";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: { code: string } };

function joinErrorRedirect(code: string, message: string): NextResponse {
  const params = new URLSearchParams({ error: message });
  return redirectSameOrigin(`/join/${code}?${params.toString()}`);
}

export async function POST(request: Request, context: RouteContext) {
  const code = normalizeJoinCode(context.params.code ?? "");
  if (code.length !== JOIN_CODE_LENGTH) {
    return redirectSameOrigin(`/join?error=${encodeURIComponent("Invalid join code.")}`);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return joinErrorRedirect(code, "Invalid form data.");
  }

  const sessionId = String(formData.get("sessionId") ?? "").trim();
  const teamId = String(formData.get("teamId") ?? "").trim();
  const displayName = normalizeDisplayName(formData.get("displayName"));

  const supabase = createClient();
  const { data: sessionRow, error: sessionLookupErr } = await supabase
    .from("sessions")
    .select("id, join_code")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionLookupErr || !sessionRow) {
    return joinErrorRedirect(code, "Session not found.");
  }

  if (normalizeJoinCode(sessionRow.join_code) !== code) {
    return joinErrorRedirect(code, "Join code does not match this session.");
  }

  const result = await joinSessionAsGuestCore({
    sessionId,
    teamId,
    displayName,
  });

  if (!result.ok) {
    return joinErrorRedirect(code, result.error);
  }

  // Relative Location keeps the browser on the host it already used (localhost,
  // LAN IP, or production). claim-participant GET sets the participant cookie
  // on a top-level navigation.
  return redirectSameOrigin(
    `/api/session/${result.sessionId}/claim-participant?pid=${encodeURIComponent(result.participantId)}`
  );
}

