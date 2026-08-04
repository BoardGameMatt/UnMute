"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PARTICIPANT_COOKIE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

async function requireLead(
  sessionId: string
): Promise<{ error: string } | { participantId: string }> {
  const cookieStore = cookies();
  const participantId = cookieStore.get(PARTICIPANT_COOKIE)?.value;
  if (!participantId) {
    redirect("/join");
  }

  const supabase = createClient();

  const { data: row, error: rowErr } = await supabase
    .from("session_participants")
    .select("role_in_session")
    .eq("session_id", sessionId)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (rowErr || !row) {
    return { error: "Could not verify your role in this session." };
  }

  if (row.role_in_session !== "lead") {
    return { error: "Only the session lead can do that." };
  }

  return { participantId };
}

/**
 * Return session_state to the shape it has before a protocol initializes:
 * phase 'waiting', an empty state_json object, round zero. state_json is
 * NOT NULL, so it is cleared to {} and never to null.
 */
async function resetSessionStateToPreInit(
  supabase: ReturnType<typeof createClient>,
  sessionId: string
) {
  const { error } = await supabase
    .from("session_state")
    .update({
      state_json: {},
      phase: "waiting",
      current_round: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId);

  return error;
}

export async function startSessionAction(
  sessionId: string
): Promise<{ error?: string } | void> {
  const auth = await requireLead(sessionId);
  if ("error" in auth) {
    return { error: auth.error };
  }

  const supabase = createClient();

  // The reset below is destructive, so it must never run against a session that is already active.
  const { data: sessionRow, error: statusErr } = await supabase
    .from("sessions")
    .select("status")
    .eq("id", sessionId)
    .maybeSingle();

  if (statusErr || !sessionRow) {
    return { error: "Could not load this session." };
  }

  if (sessionRow.status !== "lobby") {
    return { error: "This session has already started." };
  }

  // Start always begins from clean state, so a prior aborted Start cannot leave a stale roster in state_json.
  const resetErr = await resetSessionStateToPreInit(supabase, sessionId);
  if (resetErr) {
    return { error: resetErr.message };
  }

  const { error: upErr } = await supabase
    .from("sessions")
    .update({
      status: "active",
      started_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("status", "lobby");

  if (upErr) {
    return { error: upErr.message };
  }

  redirect(`/session/${sessionId}`);
}

/**
 * Send an already-started session back to the lobby.
 *
 * Order matters: clear session_state first, then flip status. A session left
 * active with intact state is recoverable; one with cleared state and active
 * status is not, so a failed reset leaves sessions untouched.
 */
export async function returnToLobbyAction(
  sessionId: string
): Promise<{ error?: string; ok?: boolean }> {
  const auth = await requireLead(sessionId);
  if ("error" in auth) {
    return { error: auth.error };
  }

  const supabase = createClient();

  const resetErr = await resetSessionStateToPreInit(supabase, sessionId);
  if (resetErr) {
    return { error: resetErr.message };
  }

  const { error: upErr } = await supabase
    .from("sessions")
    .update({
      status: "lobby",
      started_at: null,
    })
    .eq("id", sessionId);

  if (upErr) {
    return { error: upErr.message };
  }

  return { ok: true };
}

/**
 * Reassign lead to another participant in this session. Demotes every current
 * lead in the same operation so the unique one-lead index admits exactly one.
 */
export async function transferLeadAction(
  sessionId: string,
  targetParticipantId: string
): Promise<{ error?: string } | { ok: true }> {
  if (!targetParticipantId) {
    return { error: "Pick someone to make lead." };
  }

  const auth = await requireLead(sessionId);
  if ("error" in auth) {
    return { error: auth.error };
  }

  if (auth.participantId === targetParticipantId) {
    return { ok: true };
  }

  const supabase = createClient();

  const { data: target, error: targetErr } = await supabase
    .from("session_participants")
    .select("id")
    .eq("session_id", sessionId)
    .eq("participant_id", targetParticipantId)
    .maybeSingle();

  if (targetErr) {
    return { error: targetErr.message };
  }

  if (!target) {
    return { error: "That person is not in this session." };
  }

  const { error: demoteErr } = await supabase
    .from("session_participants")
    .update({ role_in_session: "member" })
    .eq("session_id", sessionId)
    .eq("role_in_session", "lead");

  if (demoteErr) {
    return { error: demoteErr.message };
  }

  const { error: promoteErr } = await supabase
    .from("session_participants")
    .update({ role_in_session: "lead" })
    .eq("session_id", sessionId)
    .eq("participant_id", targetParticipantId);

  if (promoteErr) {
    // Best-effort restore: put the caller back as lead if promote failed.
    await supabase
      .from("session_participants")
      .update({ role_in_session: "lead" })
      .eq("session_id", sessionId)
      .eq("participant_id", auth.participantId);
    return { error: promoteErr.message };
  }

  return { ok: true };
}
