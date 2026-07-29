import { NextResponse } from "next/server";
import { PARTICIPANT_COOKIE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: { id: string } | Promise<{ id: string }>;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sessionIdFromPathname(pathname: string): string | null {
  const m = pathname.match(/^\/api\/session\/([^/]+)\/claim-participant\/?$/);
  return m?.[1] ?? null;
}

/**
 * Full-page GET so Set-Cookie is applied reliably (unlike Set-Cookie on fetch()).
 * Join redirects here with ?pid= before the lobby or session load.
 */
export async function GET(request: Request, context: RouteContext) {
  const url = new URL(request.url);
  const participantId = url.searchParams.get("pid")?.trim() ?? "";

  const resolved = await Promise.resolve(context.params);
  let sessionId = resolved?.id ?? "";
  if (!sessionId) {
    sessionId = sessionIdFromPathname(url.pathname) ?? "";
  }

  if (!sessionId || !UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: "Invalid session." }, { status: 400 });
  }

  if (!UUID_RE.test(participantId)) {
    return NextResponse.json({ error: "Invalid participant." }, { status: 400 });
  }

  const supabase = createClient();
  const { data: row, error } = await supabase
    .from("session_participants")
    .select("id")
    .eq("session_id", sessionId)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json(
      { error: "You are not part of this session." },
      { status: 404 }
    );
  }

  const { data: session } = await supabase
    .from("sessions")
    .select("status")
    .eq("id", sessionId)
    .maybeSingle();

  // Active sessions skip the lobby — late joiners land in the protocol
  // (spectator if the roster was already snapshotted).
  const destPath =
    session?.status === "active"
      ? `/session/${sessionId}`
      : `/session/${sessionId}/lobby`;

  const origin = url.origin;
  const response = NextResponse.redirect(new URL(destPath, origin), 303);

  response.cookies.set(PARTICIPANT_COOKIE, participantId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
