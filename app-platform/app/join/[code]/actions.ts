"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PARTICIPANT_COOKIE, type JoinGuestResult } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export async function joinSessionAsGuest(
  _prevState: JoinGuestResult | null,
  formData: FormData
): Promise<JoinGuestResult> {
  const sessionId = String(formData.get("sessionId") ?? "").trim();
  const teamId = String(formData.get("teamId") ?? "").trim();
  const raw = formData.get("displayName");
  const displayName = typeof raw === "string" ? raw.trim() : "";

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
    role_in_session: "member",
  });

  if (spErr) {
    await supabase.from("participants").delete().eq("id", participant.id);
    return { ok: false, error: spErr.message };
  }

  const cookieStore = cookies();
  cookieStore.set(PARTICIPANT_COOKIE, participant.id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });

  redirect(`/session/${sessionId}/lobby`);
}
