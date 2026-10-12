/**
 * Airtime authorization. Service client is created only after cookie + membership.
 */

import "server-only";
import { cookies } from "next/headers";
import { PARTICIPANT_COOKIE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { isSharedScreenName } from "@/lib/protocols/rank-and-file/engine";

export type AirtimeAuthFailure = {
  ok: false;
  status: 401 | 403 | 404 | 500;
  error: string;
};

export type AirtimeMemberAuth = {
  ok: true;
  participantId: string;
  sessionId: string;
  isLead: boolean;
  isSharedScreen: boolean;
  admin: ReturnType<typeof createServiceClient>;
};

export async function authorizeAirtimeParticipant(
  sessionId: string
): Promise<AirtimeMemberAuth | AirtimeAuthFailure> {
  const cookieStore = cookies();
  const participantId = cookieStore.get(PARTICIPANT_COOKIE)?.value ?? null;

  if (!participantId) {
    return { ok: false, status: 401, error: "Not authenticated for this session." };
  }

  const supabase = createClient();
  const { data: session, error: sessionErr } = await supabase
    .from("sessions")
    .select("id, status, protocols ( slug )")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionErr) {
    return { ok: false, status: 500, error: sessionErr.message };
  }
  if (!session) {
    return { ok: false, status: 404, error: "Session not found." };
  }

  if (session.status === "cancelled" || session.status === "completed") {
    return { ok: false, status: 403, error: "This session has ended." };
  }

  const protocolEmbed = session.protocols as
    | { slug?: string }
    | { slug?: string }[]
    | null
    | undefined;
  const protocolSlug = Array.isArray(protocolEmbed)
    ? protocolEmbed[0]?.slug
    : protocolEmbed?.slug;
  if (protocolSlug !== "airtime") {
    return { ok: false, status: 404, error: "Airtime is not active on this session." };
  }

  const { data: row, error: rowErr } = await supabase
    .from("session_participants")
    .select("role_in_session, participants ( display_name )")
    .eq("session_id", sessionId)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (rowErr) {
    return { ok: false, status: 500, error: rowErr.message };
  }
  if (!row) {
    return { ok: false, status: 403, error: "Not a participant in this session." };
  }

  const person = row.participants as { display_name?: string } | { display_name?: string }[] | null;
  const displayName = Array.isArray(person) ? person[0]?.display_name : person?.display_name;

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
    isSharedScreen: isSharedScreenName(displayName ?? ""),
    admin,
  };
}
