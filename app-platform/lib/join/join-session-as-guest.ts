import { normalizeDisplayName } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export type GuestJoinCoreResult =
  | { ok: true; participantId: string; sessionId: string }
  | { ok: false; error: string };

/**
 * Inserts guest participant + session link as a member. Lead is never assigned
 * on the join-code path — only the host token URL claims lead.
 *
 * Joins are accepted while status is lobby or active. Completed/cancelled are
 * rejected. Late joiners into an already-initialized protocol land as
 * spectators (engine roster is snapshotted at initializeGame).
 */
export async function joinSessionAsGuestCore(input: {
  sessionId: string;
  teamId: string;
  displayName: string;
}): Promise<GuestJoinCoreResult> {
  const { sessionId, teamId } = input;
  const displayName = normalizeDisplayName(input.displayName);

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

  if (session.status !== "lobby" && session.status !== "active") {
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

  const { data: participant, error: pErr } = await supabase
    .from("participants")
    .insert({
      team_id: teamId,
      person_id: null,
      display_name: displayName,
      role: "member",
    })
    .select("id")
    .single();

  if (pErr) {
    return { ok: false, error: pErr.message };
  }

  const { error: spErr } = await supabase.from("session_participants").insert({
    session_id: sessionId,
    participant_id: participant.id,
    role_in_session: "member",
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
