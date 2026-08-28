/**
 * Verify production Supabase schema matches repo migrations.
 * Uses .env.local (service role). Exit 1 if anything is missing.
 *
 * npm run verify:schema
 */

import { config } from "dotenv";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env.local") });

type SchemaCheck = {
  migration: string;
  moment: string;
  table: string;
  column?: string;
};

const CHECKS: SchemaCheck[] = [
  { migration: "001", moment: "Core", table: "sessions" },
  { migration: "001", moment: "Core", table: "protocols" },
  { migration: "003", moment: "Draw It By Ear", table: "protocol_images" },
  { migration: "003", moment: "Draw It By Ear", table: "dibe_teams" },
  { migration: "002", moment: "All Moments", table: "session_feedback" },
  { migration: "005", moment: "Lead", table: "sessions", column: "designated_lead_name" },
  { migration: "006", moment: "Host link", table: "sessions", column: "host_token" },
  { migration: "008", moment: "Wrong Answers Only", table: "wao_questions" },
  { migration: "008", moment: "Wrong Answers Only", table: "wao_pairs" },
  {
    migration: "009",
    moment: "Wrong Answers Only",
    table: "session_participants",
    column: "department",
  },
  { migration: "013", moment: "Trane Quiz", table: "trane_offerings" },
  { migration: "013", moment: "Trane Quiz", table: "trane_participants" },
  { migration: "014", moment: "Cover Story", table: "cover_story_agencies" },
  { migration: "014", moment: "Cover Story", table: "cover_story_deals" },
  { migration: "014", moment: "Cover Story", table: "cover_story_sessions" },
  {
    migration: "016",
    moment: "Cover Story",
    table: "cover_story_word_logs",
    column: "note",
  },
  {
    migration: "018",
    moment: "Cover Story",
    table: "cover_story_deals",
    column: "pick_token",
  },
  { migration: "019", moment: "Talk Track", table: "content_packs" },
  { migration: "019", moment: "Talk Track", table: "talk_track_cards" },
  { migration: "019", moment: "Talk Track", table: "talk_track_sessions" },
  { migration: "019", moment: "Talk Track", table: "sessions", column: "content_pack_id" },
  { migration: "020", moment: "Unmute Console", table: "clients" },
  { migration: "020", moment: "Unmute Console", table: "staff_profiles" },
  { migration: "020", moment: "Unmute Console", table: "session_events" },
  { migration: "020", moment: "Unmute Console", table: "teams", column: "client_id" },
  { migration: "021", moment: "Zoning Rights", table: "zoning_rights_buildings" },
  { migration: "021", moment: "Zoning Rights", table: "zoning_rights_sessions" },
  { migration: "021", moment: "Zoning Rights", table: "zoning_rights_rounds" },
  { migration: "021", moment: "Zoning Rights", table: "zoning_rights_guesses" },
];

async function checkObject(
  supabase: SupabaseClient,
  check: SchemaCheck
): Promise<string | null> {
  const select = check.column ?? "*";
  const { error } = await supabase.from(check.table).select(select).limit(1);

  if (!error) return null;

  const message = error.message ?? "unknown error";
  if (
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("Could not find")
  ) {
    const target = check.column ? `${check.table}.${check.column}` : check.table;
    return `[${check.moment}] missing ${target} (migration ${check.migration}) — ${message}`;
  }

  return null;
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const host = new URL(url).hostname;
  console.log(`Verifying schema against ${host} …\n`);

  const failures: string[] = [];
  for (const check of CHECKS) {
    const failure = await checkObject(supabase, check);
    if (failure) failures.push(failure);
  }

  if (failures.length === 0) {
    console.log("All schema checks passed.");
    console.log("\nNext: smoke-test affected Moments, then share join codes.");
    return;
  }

  console.error(`Schema verification failed (${failures.length} issue(s)):\n`);
  for (const failure of failures) {
    console.error(`  • ${failure}`);
  }
  console.error("\nApply pending migrations — see docs/production-deploy.md");
  console.error("  cd app-platform && npx supabase db push");
  console.error("  or run files in supabase/migrations/ in Supabase SQL editor.");
  process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
