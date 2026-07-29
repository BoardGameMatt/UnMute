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

export async function startSessionAction(
  sessionId: string
): Promise<{ error?: string } | void> {
  const auth = await requireLead(sessionId);
  if ("error" in auth) {
    return { error: auth.error };
  }

  const supabase = createClient();

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
