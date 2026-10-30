/**
 * Print private pick links for Cover Story deals missing a lock.
 *
 * npx tsx scripts/print-cover-story-pick-links.ts V7RDHW
 */

import { config } from "dotenv";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { APP_ORIGIN_DISPLAY } from "../lib/constants";
import type { CoverStoryDeal } from "../lib/types/database";

config({ path: resolve(process.cwd(), ".env.local") });

function newPickToken(): string {
  return randomBytes(32).toString("hex");
}

async function ensureDealPickToken(
  admin: ReturnType<typeof createClient>,
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

function buildPickUrl(token: string): string {
  return `${APP_ORIGIN_DISPLAY.replace(/\/+$/, "")}/cover-story/pick/${token}`;
}

async function main(): Promise<void> {
  const joinCode = (process.argv[2] ?? "").trim().toUpperCase();
  if (!joinCode) {
    console.error("Usage: npx tsx scripts/print-cover-story-pick-links.ts <JOIN_CODE>");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: session, error: sessionErr } = await supabase
    .from("sessions")
    .select("id, join_code")
    .eq("join_code", joinCode)
    .maybeSingle();
  if (sessionErr || !session) {
    console.error("Session not found:", sessionErr?.message ?? joinCode);
    process.exit(1);
  }

  const { data: cs, error: csErr } = await supabase
    .from("cover_story_sessions")
    .select("id")
    .eq("session_id", session.id)
    .maybeSingle();
  if (csErr || !cs) {
    console.error("Cover Story session missing:", csErr?.message);
    process.exit(1);
  }

  const { data: dealsRaw, error: dealsErr } = await supabase
    .from("cover_story_deals")
    .select("*")
    .eq("cover_story_session_id", cs.id);
  if (dealsErr) {
    console.error(dealsErr.message);
    process.exit(1);
  }

  const deals = (dealsRaw ?? []) as CoverStoryDeal[];
  const unlocked = deals.filter((deal) => !deal.locked_agency_id);
  if (unlocked.length === 0) {
    console.log(`All agents locked for ${joinCode}.`);
    return;
  }

  console.log(`Pick links for ${joinCode} (${unlocked.length} without lock):\n`);

  for (const deal of unlocked) {
    const token = await ensureDealPickToken(supabase, deal);
    const { data: participant } = await supabase
      .from("participants")
      .select("display_name")
      .eq("id", deal.participant_id)
      .maybeSingle();
    const name = (participant as { display_name?: string } | null)?.display_name ?? "Agent";
    console.log(`${name}`);
    console.log(`  ${buildPickUrl(token)}\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
