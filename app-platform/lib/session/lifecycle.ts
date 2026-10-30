import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const loadLifecycle = async (admin: SupabaseClient, sessionId: string) => {
  const { data, error } = await admin.from("sessions").select("status, lifecycle_version")
    .eq("id", sessionId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Session not found.");
  return data as { status: string; lifecycle_version: number };
};
