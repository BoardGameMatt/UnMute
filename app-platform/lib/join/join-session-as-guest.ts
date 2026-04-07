import { createClient } from "@/lib/supabase/server";

export type GuestJoinCoreResult =
  | { ok: true; participantId: string; sessionId: string }
  | { ok: false; error: string };

/**
 * Inserts guest participant + session link. Caller sets cookie and redirects.
 * Used by API route (preferred) so POST does not target /join/[code] RSC page.
 */
export async function joinSessionAsGuestCore(input: {
  sessionId: string;
  teamId: string;
  displayName: string;
}): Promise<GuestJoinCoreResult> {
  const { sessionId, teamId, displayName } = input;

  if (!sessionId || !teamId) {
    return { ok: false, error: "Missing session context. Refresh and try again." };
  }

  if (!displayName) {
    return { ok: false, error: "Enter a display name to continue." };
  }

  const supabase = createClient();

  const { data: session, error: sessionErr } = await supabase
    .from("sessions")
    .select("id, team_id, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionErr || !session) {
    return { ok: false, error: "Session not found." };
  }

  if (session.team_id !== teamId) {
    return { ok: false, error: "Invalid session context." };
  }

  if (session.status !== "lobby") {
    return { ok: false, error: "This session is no longer accepting joins." };
  }

  const { data: team, error: teamErr } = await supabase
    .from("teams")
    .select("id, require_auth")
    .eq("id", teamId)
    .maybeSingle();

  if (teamErr || !team) {
    return { ok: false, error: "Team not found." };
  }

  if (team.require_auth) {
    return { ok: false, error: "This team requires sign-in to join." };
  }

  const { count: existingCount, error: countErr } = await supabase
    .from("session_participants")
    .select("*", { count: "exact", head: true })
    .eq("session_id", sessionId);

  if (countErr) {
    return { ok: false, error: countErr.message };
  }

  const isFirstJoin = (existingCount ?? 0) === 0;
  const sessionRole = isFirstJoin ? "lead" : "member";

  const { data: participant, error: pErr } = await supabase
    .from("participants")
    .insert({
      team_id: teamId,
      person_id: null,
      display_name: displayName,
      role: sessionRole,
    })
    .select("id")
    .single();

  if (pErr) {
    if (pErr.code === "23505") {
      return {
        ok: false,
        error: "That name is already taken in this team. Try another.",
      };
    }
    return { ok: false, error: pErr.message };
  }

  const { error: spErr } = await supabase.from("session_participants").insert({
    session_id: sessionId,
    participant_id: participant.id,
    role_in_session: sessionRole,
  });

  if (spErr) {
    await supabase.from("participants").delete().eq("id", participant.id);
    return { ok: false, error: spErr.message };
  }

  return {
    ok: true,
    participantId: participant.id,
    sessionId,
  };
}
