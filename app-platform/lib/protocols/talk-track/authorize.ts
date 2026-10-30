/**
 * Talk Track authorization. Service client is created only after cookie + membership.
 */

import "server-only";
import { cookies } from "next/headers";
import { PARTICIPANT_COOKIE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";

export type TalkTrackAuthFailure = {
  ok: false;
  status: 401 | 403 | 404 | 500;
  error: string;
};

export type TalkTrackMemberAuth = {
  ok: true;
  participantId: string;
  sessionId: string;
  isLead: boolean;
  admin: ReturnType<typeof createServiceClient>;
};

export type TalkTrackLeadAuth = TalkTrackMemberAuth & { isLead: true };

export async function authorizeTalkTrackParticipant(
  sessionId: string
): Promise<TalkTrackMemberAuth | TalkTrackAuthFailure> {
  const cookieStore = cookies();
  const participantId = cookieStore.get(PARTICIPANT_COOKIE)?.value ?? null;

  if (!participantId) {
    return { ok: false, status: 401, error: "Not authenticated for this session." };
  }

  const supabase = createClient();
  const { data: session, error: sessionErr } = await supabase
    .from("sessions")
    .select("id, protocols ( slug )")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionErr) {
    return { ok: false, status: 500, error: sessionErr.message };
  }
  if (!session) {
    return { ok: false, status: 404, error: "Session not found." };
  }

  const protocolEmbed = session.protocols as
    | { slug?: string }
    | { slug?: string }[]
    | null
    | undefined;
  const protocolSlug = Array.isArray(protocolEmbed)
    ? protocolEmbed[0]?.slug
    : protocolEmbed?.slug;
  if (protocolSlug !== "talk-track") {
    return { ok: false, status: 404, error: "Talk Track is not active on this session." };
  }

  const { data: row, error: rowErr } = await supabase
    .from("session_participants")
    .select("role_in_session")
    .eq("session_id", sessionId)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (rowErr) {
    return { ok: false, status: 500, error: rowErr.message };
  }
  if (!row) {
    return { ok: false, status: 403, error: "Not a participant in this session." };
  }

  let admin: ReturnType<typeof createServiceClient>;
  try {
    admin = createServiceClient();
  } catch {
    return { ok: false, status: 500, error: "Service client is not configured." };
  }

  return {
    ok: true,
    participantId,
    sessionId,
    isLead: row.role_in_session === "lead",
    admin,
  };
}

export async function authorizeTalkTrackLead(
  sessionId: string
): Promise<TalkTrackLeadAuth | TalkTrackAuthFailure> {
  const auth = await authorizeTalkTrackParticipant(sessionId);
  if (!auth.ok) return auth;
  if (!auth.isLead) {
    return { ok: false, status: 403, error: "Only the session lead can do that." };
  }
  return { ...auth, isLead: true };
}
