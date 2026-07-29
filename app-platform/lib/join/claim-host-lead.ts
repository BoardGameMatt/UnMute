import { normalizeDisplayName } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export type ClaimHostResult =
  | { ok: true; participantId: string; sessionId: string }
  | { ok: false; error: string; status?: number };

/**
 * Claims lead for this browser via the unguessable host token.
 * - Existing cookie participant already in the session → promote them (transfer).
 * - Otherwise create a new participant as lead (requires displayName).
 * Always demotes any previous lead first so the one-lead unique index holds.
 */
export async function claimHostLead(input: {
  hostToken: string;
  displayName?: string;
  existingParticipantId?: string | null;
}): Promise<ClaimHostResult> {
  const hostToken = input.hostToken.trim();
  if (!hostToken || hostToken.length < 32) {
    return { ok: false, error: "Invalid host link.", status: 400 };
  }

  const supabase = createClient();

  const { data: session, error: sessionErr } = await supabase
    .from("sessions")
    .select("id, team_id, status")
    .eq("host_token", hostToken)
    .maybeSingle();

  if (sessionErr || !session) {
    return { ok: false, error: "Host link not found.", status: 404 };
  }

  if (session.status === "completed" || session.status === "cancelled") {
    return {
      ok: false,
      error: "This session has ended.",
      status: 400,
    };
  }

  const existingId = input.existingParticipantId?.trim() || null;

  if (existingId) {
    const { data: membership } = await supabase
      .from("session_participants")
      .select("id")
      .eq("session_id", session.id)
      .eq("participant_id", existingId)
      .maybeSingle();

    if (membership) {
      const demoted = await demoteLeads(supabase, session.id);
      if (!demoted.ok) return demoted;

      const { error: promoteErr } = await supabase
        .from("session_participants")
        .update({ role_in_session: "lead" })
        .eq("session_id", session.id)
        .eq("participant_id", existingId);

      if (promoteErr) {
        return { ok: false, error: promoteErr.message, status: 500 };
      }

      return {
        ok: true,
        participantId: existingId,
        sessionId: session.id,
      };
    }
  }

  const displayName = normalizeDisplayName(input.displayName);
  if (!displayName) {
    return {
      ok: false,
      error: "Enter a display name to continue.",
      status: 400,
    };
  }

  const demoted = await demoteLeads(supabase, session.id);
  if (!demoted.ok) return demoted;

  const { data: participant, error: pErr } = await supabase
    .from("participants")
    .insert({
      team_id: session.team_id,
      person_id: null,
      display_name: displayName,
      role: "lead",
    })
    .select("id")
    .single();

  if (pErr) {
    return { ok: false, error: pErr.message, status: 500 };
  }

  const { error: spErr } = await supabase.from("session_participants").insert({
    session_id: session.id,
    participant_id: participant.id,
    role_in_session: "lead",
  });

  if (spErr) {
    await supabase.from("participants").delete().eq("id", participant.id);
    // Unique one-lead race: someone else claimed between demote and insert.
    if (spErr.code === "23505") {
      return {
        ok: false,
        error: "Could not claim lead. Refresh and try again.",
        status: 409,
      };
    }
    return { ok: false, error: spErr.message, status: 500 };
  }

  return {
    ok: true,
    participantId: participant.id,
    sessionId: session.id,
  };
}

async function demoteLeads(
  supabase: ReturnType<typeof createClient>,
  sessionId: string
): Promise<{ ok: true } | ClaimHostResult> {
  const { error } = await supabase
    .from("session_participants")
    .update({ role_in_session: "member" })
    .eq("session_id", sessionId)
    .eq("role_in_session", "lead");

  if (error) {
    return { ok: false, error: error.message, status: 500 };
  }
  return { ok: true };
}
