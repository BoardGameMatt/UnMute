/**
 * Section 16 authorization for pair-scoped WAO routes.
 *
 * The service client bypasses RLS, so this helper is the only gate preventing
 * cross-pair access. Every pair route must call it before any other admin use.
 */

import "server-only";
import { cookies } from "next/headers";
import { PARTICIPANT_COOKIE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import type { WaoPair, WaoRound, WaoSession } from "@/lib/types/database";

export type PairAuthSuccess = {
  ok: true;
  participantId: string;
  pair: WaoPair;
  round: WaoRound;
  waoSession: WaoSession;
  /** Already-authorized service client. Prefer this over creating another. */
  admin: ReturnType<typeof createServiceClient>;
};

export type PairAuthFailure = {
  ok: false;
  status: 401 | 403 | 404 | 500;
  error: string;
};

export type PairAuthResult = PairAuthSuccess | PairAuthFailure;

function isPairMember(pair: WaoPair, participantId: string): boolean {
  return (
    pair.participant_a === participantId ||
    pair.participant_b === participantId
  );
}

/**
 * Verify cookie identity, session membership, and membership of this pair.
 * Cookie is checked before createServiceClient. Pair/round loads use the
 * service client only inside this helper, which is the Section 16 gate.
 */
export async function authorizePairMember(pairId: string): Promise<PairAuthResult> {
  const cookieStore = cookies();
  const participantId = cookieStore.get(PARTICIPANT_COOKIE)?.value ?? null;

  if (!participantId) {
    return { ok: false, status: 401, error: "Not authenticated for this session." };
  }

  if (!pairId || typeof pairId !== "string") {
    return { ok: false, status: 404, error: "Pair not found." };
  }

  let admin: ReturnType<typeof createServiceClient>;
  try {
    admin = createServiceClient();
  } catch {
    return { ok: false, status: 500, error: "Service client is not configured." };
  }

  const { data: pairRaw, error: pairErr } = await admin
    .from("wao_pairs")
    .select("*")
    .eq("id", pairId)
    .maybeSingle();

  if (pairErr) {
    return { ok: false, status: 500, error: pairErr.message };
  }
  if (!pairRaw) {
    return { ok: false, status: 404, error: "Pair not found." };
  }

  const pair = pairRaw as WaoPair;

  if (!isPairMember(pair, participantId)) {
    return { ok: false, status: 403, error: "Not a member of this pair." };
  }

  const { data: roundRaw, error: roundErr } = await admin
    .from("wao_rounds")
    .select("*")
    .eq("id", pair.round_id)
    .maybeSingle();

  if (roundErr) {
    return { ok: false, status: 500, error: roundErr.message };
  }
  if (!roundRaw) {
    return { ok: false, status: 404, error: "Round not found." };
  }

  const round = roundRaw as WaoRound;

  const { data: waoSessionRaw, error: waoSessionErr } = await admin
    .from("wao_sessions")
    .select("*")
    .eq("id", round.wao_session_id)
    .maybeSingle();

  if (waoSessionErr) {
    return { ok: false, status: 500, error: waoSessionErr.message };
  }
  if (!waoSessionRaw) {
    return { ok: false, status: 404, error: "WAO session not found." };
  }

  const waoSession = waoSessionRaw as WaoSession;

  const supabase = createClient();
  const { data: link, error: linkErr } = await supabase
    .from("session_participants")
    .select("id")
    .eq("session_id", waoSession.session_id)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (linkErr) {
    return { ok: false, status: 500, error: linkErr.message };
  }
  if (!link) {
    return { ok: false, status: 403, error: "Not a participant in this session." };
  }

  return { ok: true, participantId, pair, round, waoSession, admin };
}

export type SessionAuthSuccess = {
  ok: true;
  participantId: string;
  sessionId: string;
  admin: ReturnType<typeof createServiceClient>;
};

export type SessionAuthResult = SessionAuthSuccess | PairAuthFailure;

/**
 * Cookie + session_participants check for session-scoped discovery routes.
 * Service client is created only after membership passes.
 */
export async function authorizeSessionParticipant(
  sessionId: string
): Promise<SessionAuthResult> {
  const cookieStore = cookies();
  const participantId = cookieStore.get(PARTICIPANT_COOKIE)?.value ?? null;

  if (!participantId) {
    return { ok: false, status: 401, error: "Not authenticated for this session." };
  }

  const supabase = createClient();
  const { data: link, error: linkErr } = await supabase
    .from("session_participants")
    .select("id")
    .eq("session_id", sessionId)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (linkErr) {
    return { ok: false, status: 500, error: linkErr.message };
  }
  if (!link) {
    return { ok: false, status: 403, error: "Not a participant in this session." };
  }

  let admin: ReturnType<typeof createServiceClient>;
  try {
    admin = createServiceClient();
  } catch {
    return { ok: false, status: 500, error: "Service client is not configured." };
  }

  return { ok: true, participantId, sessionId, admin };
}
