"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PARTICIPANT_COOKIE } from "@/lib/constants";
import { writeSessionEvent } from "@/lib/console/session-events";
import { resetCoverStorySessionToLobby } from "@/lib/cover-story/session";
import { resetAirtimeToLobby, startAirtime } from "@/lib/protocols/airtime/actions";
import { AIRTIME_CONFIG } from "@/lib/protocols/airtime/config";
import { OTSP } from "@/lib/protocols/on-the-same-page/config";
import { resetOnTheSamePageToLobby, startOnTheSamePage } from "@/lib/protocols/on-the-same-page/actions";
import { startSayLess } from "@/lib/protocols/say-less/actions";
import { resetRankAndFileToLobby, startRankAndFile } from "@/lib/protocols/rank-and-file/actions";
import { isSharedScreenName } from "@/lib/protocols/rank-and-file/engine";
import { startCodeSwitch } from "@/lib/protocols/code-switch/actions";
import { resetIkwymToLobby, startIkwym } from "@/lib/protocols/i-know-what-you-meme/actions";
import { resetTruthIsToLobby, startTruthIs } from "@/lib/protocols/the-truth-is/actions";
import { resetTalkTrackToLobby, startTalkTrack } from "@/lib/protocols/talk-track/actions";
import { resetZoningRightsToLobby, startZoningRights } from "@/lib/protocols/zoning-rights/actions";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { withWorkshopTransaction } from "@/lib/session/workshop-transaction";

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
  sessionId: string, expectedVersion?: number
): Promise<{ error?: string } | void> {
  const auth = await requireLead(sessionId);
  if ("error" in auth) {
    return { error: auth.error };
  }

  const supabase = createClient();

  // The reset below is destructive, so it must never run against a session that is already active.
  const { data: sessionRow, error: statusErr } = await supabase
    .from("sessions")
    .select("status, lifecycle_version")
    .eq("id", sessionId)
    .maybeSingle();

  if (statusErr || !sessionRow) {
    return { error: "Could not load this session." };
  }

  if (sessionRow.status !== "lobby") {
    if (sessionRow.status === "cancelled") {
      return { error: "This session was cancelled." };
    }
    return { error: "This session has already started." };
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

  if (protocolSlug === "cover-story") {
    let revealOn: string | null = null;
    try {
      const admin = createServiceClient();
      const cs = await admin
        .from("cover_story_sessions")
        .select("reveal_on")
        .eq("session_id", sessionId)
        .maybeSingle();
      revealOn = (cs.data as { reveal_on?: string | null } | null)?.reveal_on ?? null;
    } catch {
      return { error: "Could not verify Cover Story settings." };
    }
    if (!revealOn) {
      return { error: "Set the reveal date before starting." };
    }
    const { data: memberRows } = await supabase
      .from("session_participants")
      .select("role_in_session")
      .eq("session_id", sessionId);
    const playerCount = (memberRows ?? []).filter(
      (row) => row.role_in_session !== "lead"
    ).length;
    if (playerCount < 2) {
      return { error: "Need at least 2 players plus the facilitator." };
    }
  }

  if (protocolSlug === "talk-track") {
    const { count, error: countErr } = await supabase
      .from("session_participants")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId);
    if (countErr) {
      return { error: "Could not count the room." };
    }
    if ((count ?? 0) < 4) {
      return { error: "Talk Track needs at least 4 people." };
    }
  }

  if (protocolSlug === "zoning-rights") {
    const { count, error: countErr } = await supabase
      .from("session_participants")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId);
    if (countErr) {
      return { error: "Could not count the room." };
    }
    if ((count ?? 0) < 3) {
      return { error: "Need 3 to start." };
    }
  }

  if (protocolSlug === "i-know-what-you-meme") {
    const { count, error: countErr } = await supabase
      .from("session_participants")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId);
    if (countErr) {
      return { error: "Could not count the room." };
    }
    if ((count ?? 0) < 3) {
      return { error: "Need 3 to start." };
    }
  }

  if (protocolSlug === "rank-and-file") {
    const { data: rows, error: countErr } = await supabase
      .from("session_participants")
      .select("participants ( display_name )")
      .eq("session_id", sessionId);
    if (countErr) {
      return { error: "Could not count the room." };
    }
    const players = (rows ?? []).filter((row) => {
      const person = row.participants as { display_name?: string } | { display_name?: string }[] | null;
      const name = Array.isArray(person) ? person[0]?.display_name : person?.display_name;
      return !isSharedScreenName(name ?? "Player");
    });
    if (players.length < 3) {
      return { error: "Need 3 to start." };
    }
  }

  if (protocolSlug === "code-switch") {
    const { count, error: countErr } = await supabase
      .from("session_participants")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId);
    if (countErr) {
      return { error: "Could not count the room." };
    }
    if ((count ?? 0) < 4) {
      return { error: "Need 4 to start." };
    }
  }

  if (protocolSlug === "the-truth-is") {
    const { data: rows, error: countErr } = await supabase
      .from("session_participants")
      .select("participants ( display_name )")
      .eq("session_id", sessionId);
    if (countErr) {
      return { error: "Could not count the room." };
    }
    const players = (rows ?? []).filter((row) => {
      const person = row.participants as { display_name?: string } | { display_name?: string }[] | null;
      const name = Array.isArray(person) ? person[0]?.display_name : person?.display_name;
      return !isSharedScreenName(name ?? "Player");
    });
    if (players.length < 3) {
      return { error: "Need 3 to start." };
    }
  }

  if (protocolSlug === "airtime") {
    const { data: rows, error: countErr } = await supabase
      .from("session_participants")
      .select("participants ( display_name )")
      .eq("session_id", sessionId);
    if (countErr) {
      return { error: "Could not count the room." };
    }
    const players = (rows ?? []).filter((row) => {
      const person = row.participants as { display_name?: string } | { display_name?: string }[] | null;
      const name = Array.isArray(person) ? person[0]?.display_name : person?.display_name;
      return !isSharedScreenName(name ?? "Player");
    });
    if (players.length < AIRTIME_CONFIG.minPlayers) {
      return { error: "Need 2 to start." };
    }
    if (players.length > AIRTIME_CONFIG.maxPlayers) {
      return { error: "Airtime holds 16 players at most." };
    }
  }

  if (protocolSlug === "on-the-same-page") {
    const { data: rows, error: countErr } = await supabase
      .from("session_participants")
      .select("participants ( display_name )")
      .eq("session_id", sessionId);
    if (countErr) {
      return { error: "Could not count the room." };
    }
    const players = (rows ?? []).filter((row) => {
      const person = row.participants as { display_name?: string } | { display_name?: string }[] | null;
      const name = Array.isArray(person) ? person[0]?.display_name : person?.display_name;
      return !isSharedScreenName(name ?? "Player");
    });
    if (players.length < OTSP.minPlayers) {
      return { error: "Need 8 to start." };
    }
    if (players.length > OTSP.maxPlayers) {
      return { error: "On the Same Page holds 16 players at most." };
    }
  }

  if (protocolSlug === "say-less") {
    const { count, error: countErr } = await supabase
      .from("session_participants")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId);
    if (countErr) {
      return { error: "Could not count the room." };
    }
    if ((count ?? 0) < 4) {
      return { error: "Say Less needs at least 4 people." };
    }
    if ((count ?? 0) > 14) {
      return { error: "Say Less holds 14 people at most." };
    }
  }

  if (["code-switch", "say-less", "draw-it-by-ear", "wrong-answers-only"].includes(protocolSlug ?? "")) {
    const admin = createServiceClient();
    const generation = expectedVersion ?? sessionRow.lifecycle_version as number;
    try {
      const result = protocolSlug === "code-switch" ? await startCodeSwitch(admin, sessionId, generation)
        : protocolSlug === "say-less" ? await startSayLess(admin, sessionId, generation)
        : await admin.rpc("start_workshop_session", { p_session_id: sessionId,
          p_protocol: protocolSlug, p_expected_version: generation, p_init: {} }).then(({ data, error }) =>
            error || data !== true ? { ok: false as const, error: error?.message ?? "The workshop changed before Start." } : { ok: true as const });
      if (!result.ok) return { error: result.error };
    } catch (error) { return { error: error instanceof Error ? error.message : "Could not start the workshop." }; }
    await writeSessionEvent(admin, { sessionId, type: "session_started", actorKind: "participant", actorId: auth.participantId });
    redirect(`/session/${sessionId}`);
  }

  const tabularStarters: Record<string, typeof startAirtime> = {
    "talk-track": startTalkTrack, "zoning-rights": startZoningRights,
    "i-know-what-you-meme": startIkwym, "rank-and-file": startRankAndFile,
    "the-truth-is": startTruthIs, airtime: startAirtime, "on-the-same-page": startOnTheSamePage,
  };
  if (protocolSlug && (tabularStarters[protocolSlug] || protocolSlug === "cover-story")) {
    const admin = createServiceClient();
    try {
      const started = await withWorkshopTransaction(admin, sessionId, "start", client =>
        tabularStarters[protocolSlug] ? tabularStarters[protocolSlug](client, sessionId) : Promise.resolve({ ok: true as const }),
        expectedVersion ?? sessionRow.lifecycle_version as number);
      if (!started.ok) return { error: started.error };
    } catch (error) { return { error: error instanceof Error ? error.message : "Could not start the workshop." }; }
    await writeSessionEvent(admin, { sessionId, type: "session_started", actorKind: "participant", actorId: auth.participantId });
    redirect(`/session/${sessionId}`);
  }

  // Fallback for an unregistered protocol; known protocol initializers above are atomic.
  const resetErr = await resetSessionStateToPreInit(supabase, sessionId);
  if (resetErr) {
    return { error: resetErr.message };
  }

  const { data: activated, error: upErr } = await supabase
    .from("sessions")
    .update({
      status: "active",
      started_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("status", "lobby")
    .select("id")
    .maybeSingle();

  if (upErr) {
    return { error: upErr.message };
  }

  if (!activated) {
    return {
      error:
        "Could not start this session — it may have been cancelled or already started.",
    };
  }

  await writeSessionEvent(createServiceClient(), {
    sessionId,
    type: "session_started",
    actorKind: "participant",
    actorId: auth.participantId,
  });

  redirect(`/session/${sessionId}`);
}

/**
 * Send an already-started session back to the lobby.
 *
 * Migrated protocols reset state, protocol rows and status in one transaction.
 * Registered protocols commit the complete reset in the same transaction.
 */
export async function returnToLobbyAction(
  sessionId: string, expectedVersion?: number
): Promise<{ error?: string; ok?: boolean }> {
  const auth = await requireLead(sessionId);
  if ("error" in auth) {
    return { error: auth.error };
  }

  const supabase = createClient();

  const { data: lifecycle, error: lifecycleError } = await supabase.from("sessions")
    .select("status, lifecycle_version, protocols ( slug )").eq("id", sessionId).maybeSingle();
  if (lifecycleError || !lifecycle) return { error: "Could not load the workshop." };
  const embedded = lifecycle.protocols as { slug: string } | { slug: string }[] | null;
  const slug = Array.isArray(embedded) ? embedded[0]?.slug : embedded?.slug;
  if (["code-switch", "say-less", "draw-it-by-ear", "wrong-answers-only"].includes(slug ?? "")) {
    const { data, error } = await createServiceClient().rpc("reset_workshop_session", {
      p_session_id: sessionId, p_expected_version: expectedVersion ?? lifecycle.lifecycle_version,
    });
    return error || data !== true ? { error: error?.message ?? "The workshop changed. Refresh before resetting." } : { ok: true };
  }

  const tabularResetters: Record<string, typeof resetAirtimeToLobby> = {
    "talk-track": resetTalkTrackToLobby, "zoning-rights": resetZoningRightsToLobby,
    "i-know-what-you-meme": resetIkwymToLobby, "rank-and-file": resetRankAndFileToLobby,
    "the-truth-is": resetTruthIsToLobby, airtime: resetAirtimeToLobby,
    "on-the-same-page": resetOnTheSamePageToLobby, "cover-story": resetCoverStorySessionToLobby,
  };
  if (slug && tabularResetters[slug]) {
    try {
      await withWorkshopTransaction(createServiceClient(), sessionId, "reset", client => tabularResetters[slug](client, sessionId),
        expectedVersion ?? lifecycle.lifecycle_version as number);
      return { ok: true };
    } catch (error) { return { error: error instanceof Error ? error.message : "Could not reset the workshop." }; }
  }

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
