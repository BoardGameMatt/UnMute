import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CoverStoryDeal } from "@/lib/types/database";

export function newPickToken(): string {
  return randomBytes(32).toString("hex");
}

/** Ensure every deal has an unguessable pick token for the private pick page. */
export async function ensureDealPickToken(
  admin: SupabaseClient,
  deal: CoverStoryDeal
): Promise<string> {
  if (deal.pick_token) return deal.pick_token;

  const token = newPickToken();
  const { error } = await admin
    .from("cover_story_deals")
    .update({ pick_token: token })
    .eq("id", deal.id)
    .is("pick_token", null);
  if (error) throw new Error(error.message);

  const { data: raced } = await admin
    .from("cover_story_deals")
    .select("pick_token")
    .eq("id", deal.id)
    .maybeSingle();
  return (raced as { pick_token: string } | null)?.pick_token ?? token;
}
