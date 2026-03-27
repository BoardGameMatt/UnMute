"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PARTICIPANT_COOKIE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export async function startSessionAction(
  sessionId: string
): Promise<{ error?: string } | void> {
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
    return { error: "Only the session lead can start." };
  }

  const { count, error: countErr } = await supabase
    .from("session_participants")
    .select("*", { count: "exact", head: true })
    .eq("session_id", sessionId);

  if (countErr || count === null || count < 2) {
    return { error: "At least two participants are required to start." };
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
