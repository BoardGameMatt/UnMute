/**
 * Append a session_events row. Failures are logged; they must not break play.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json, SessionEventActorKind } from "@/lib/types/database";

export async function writeSessionEvent(
  admin: SupabaseClient,
  args: {
    sessionId: string;
    type: string;
    actorKind: SessionEventActorKind;
    actorId?: string | null;
    payload?: Json;
  }
): Promise<void> {
  const { error } = await admin.from("session_events").insert({
    session_id: args.sessionId,
    type: args.type,
    actor_kind: args.actorKind,
    actor_id: args.actorId ?? null,
    payload: args.payload ?? {},
  });
  if (error) {
    console.error("[session_events]", args.type, error.message);
  }
}
