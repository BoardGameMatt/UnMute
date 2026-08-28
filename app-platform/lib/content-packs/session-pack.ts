/**
 * Resolve the content pack bound to a session. Pack-required Moments must
 * load library rows through this id — never the global pool.
 *
 * Sessions minted outside the console (seed/scripts) may lack content_pack_id.
 * In that case we bind Pack A for the protocol, matching Talk Track's
 * resolvePackId behavior.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type SessionPackResult =
  | { ok: true; contentPackId: string }
  | { ok: false; error: string };

export async function resolveSessionContentPackId(
  admin: SupabaseClient,
  sessionId: string
): Promise<SessionPackResult> {
  const { data, error } = await admin
    .from("sessions")
    .select("content_pack_id, protocol_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data) {
    return { ok: false, error: "Session not found." };
  }
  if (data.content_pack_id) {
    return { ok: true, contentPackId: data.content_pack_id as string };
  }

  const { data: pack, error: packErr } = await admin
    .from("content_packs")
    .select("id")
    .eq("protocol_id", data.protocol_id)
    .eq("slug", "a")
    .eq("status", "active")
    .maybeSingle();

  if (packErr) {
    return { ok: false, error: packErr.message };
  }
  if (!pack) {
    return {
      ok: false,
      error: "Pack A is not installed for this protocol.",
    };
  }

  const { error: upErr } = await admin
    .from("sessions")
    .update({ content_pack_id: pack.id })
    .eq("id", sessionId)
    .is("content_pack_id", null);

  if (upErr) {
    return { ok: false, error: upErr.message };
  }

  // Re-read in case a concurrent writer won the race.
  const { data: again, error: againErr } = await admin
    .from("sessions")
    .select("content_pack_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (againErr) {
    return { ok: false, error: againErr.message };
  }
  if (!again?.content_pack_id) {
    return { ok: false, error: "Could not bind a content pack to this session." };
  }

  return { ok: true, contentPackId: again.content_pack_id as string };
}

/** Pure filter for tests and callers that already hold pack-tagged rows. */
export function filterByContentPackId<T extends { content_pack_id: string }>(
  rows: readonly T[],
  contentPackId: string
): T[] {
  return rows.filter((row) => row.content_pack_id === contentPackId);
}
