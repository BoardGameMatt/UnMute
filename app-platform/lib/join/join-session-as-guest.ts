import { normalizeDisplayName } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { AIRTIME_CONFIG } from "@/lib/protocols/airtime/config";
import { isSharedScreenName } from "@/lib/protocols/rank-and-file/engine";

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

  const { data: protocolRow } = await supabase
    .from("sessions")
    .select("protocols ( slug )")
    .eq("id", sessionId)
    .maybeSingle();
  const protocolEmbed = protocolRow?.protocols as
    | { slug?: string }
    | { slug?: string }[]
    | null
    | undefined;
  const protocolSlug = Array.isArray(protocolEmbed)
    ? protocolEmbed[0]?.slug
    : protocolEmbed?.slug;

  if (protocolSlug === "cover-story" && session.status === "active") {
    return {
      ok: false,
      error:
        "This Cover Story session already started. Tap your name to rejoin, or ask the facilitator to admit you.",
    };
  }

  if (protocolSlug === "airtime") {
    if (session.status === "active") {
      return {
        ok: false,
        error: "This Airtime session already started. Tap your name to rejoin.",
      };
    }
    if (isSharedScreenName(displayName)) {
      return { ok: false, error: "That name is reserved. Pick another." };
    }
    const { data: rows, error: countErr } = await supabase
      .from("session_participants")
      .select("participants ( display_name )")
      .eq("session_id", sessionId);
    if (countErr) {
      return { ok: false, error: "Could not count the room. Try again." };
    }
    const players = (rows ?? []).filter((row) => {
      const person = row.participants as { display_name?: string } | { display_name?: string }[] | null;
      const name = Array.isArray(person) ? person[0]?.display_name : person?.display_name;
      return !isSharedScreenName(name ?? "Player");
    });
    if (players.length >= AIRTIME_CONFIG.maxPlayers) {
      return { ok: false, error: "This moment is full." };
    }
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
