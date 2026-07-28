import { NextResponse } from "next/server";
import { normalizeDisplayName } from "@/lib/constants";
import { joinSessionAsGuestCore } from "@/lib/join/join-session-as-guest";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: { code: string } };

function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export async function POST(request: Request, context: RouteContext) {
  const code = normalizeCode(context.params.code ?? "");
  if (code.length !== 6) {
    return NextResponse.json({ error: "Invalid join code." }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
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
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  if (sessionRow.join_code !== code) {
    return NextResponse.json(
      { error: "Join code does not match this session." },
      { status: 400 }
    );
  }

  const result = await joinSessionAsGuestCore({
    sessionId,
    teamId,
    displayName,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const claimUrl = new URL(
    `/api/session/${result.sessionId}/claim-participant`,
    origin
  );
  claimUrl.searchParams.set("pid", result.participantId);

  // Redirect through claim-participant GET so the browser applies Set-Cookie on
  // a top-level navigation (reliable for every profile). Do not rely on
  // Set-Cookie from fetch() before client-side location changes.
  return NextResponse.redirect(claimUrl, 303);
}
