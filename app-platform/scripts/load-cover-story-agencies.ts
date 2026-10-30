/**
 * Load cover-story-agencies-v1.json into cover_story_agencies / words.
 * Run from app-platform: npm run load:cover-story
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * Additive and idempotent: skips agency ids already present. Never deletes.
 */

import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env.local") });

const DEFAULT_LIBRARY_PATH = "supabase/seed-data/cover-story-agencies-v1.json";

type LibraryWord = {
  ordinal: number;
  phrase: string;
  difficulty: number;
};

type LibraryAgency = {
  id: number;
  slug: string;
  official_name: string;
  aliases: string[];
  kind: string;
  pop_culture: boolean;
  tier: number;
  playable: boolean;
  active: boolean;
  hr_safe: boolean;
  notes: string;
  words: LibraryWord[];
};

type LibraryFile = {
  version: number;
  agencies: LibraryAgency[];
};

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
    process.exit(1);
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function main(): Promise<void> {
  const libraryPath = process.argv[2] ?? DEFAULT_LIBRARY_PATH;
  const library = JSON.parse(
    readFileSync(resolve(process.cwd(), libraryPath), "utf8")
  ) as LibraryFile;

  if (!Array.isArray(library.agencies) || library.agencies.length === 0) {
    console.error("agencies is missing or empty.");
    process.exit(1);
  }

  const supabase = createServiceClient();
  let inserted = 0;
  let skipped = 0;

  for (const agency of library.agencies) {
    const { data: existing, error: lookupErr } = await supabase
      .from("cover_story_agencies")
      .select("id")
      .eq("id", agency.id)
      .maybeSingle();

    if (lookupErr) {
      console.error(`Lookup failed for ${agency.official_name}:`, lookupErr.message);
      process.exit(1);
    }
    if (existing) {
      skipped += 1;
      continue;
    }

    const { error: agencyErr } = await supabase.from("cover_story_agencies").insert({
      id: agency.id,
      slug: agency.slug,
      official_name: agency.official_name,
      aliases: agency.aliases,
      kind: agency.kind,
      pop_culture: agency.pop_culture,
      tier: agency.tier,
      playable: agency.playable,
      active: agency.active,
      hr_safe: agency.hr_safe,
      notes: agency.notes,
    });
    if (agencyErr) {
      console.error(`Insert failed for ${agency.official_name}:`, agencyErr.message);
      process.exit(1);
    }

    const { error: wordsErr } = await supabase.from("cover_story_agency_words").insert(
      agency.words.map((word) => ({
        agency_id: agency.id,
        ordinal: word.ordinal,
        phrase: word.phrase,
        difficulty: word.difficulty,
      }))
    );
    if (wordsErr) {
      console.error(`Word insert failed for ${agency.official_name}:`, wordsErr.message);
      process.exit(1);
    }
    inserted += 1;
    console.log(`Inserted: ${agency.official_name}`);
  }

  console.log(`Done. Inserted ${inserted}. Skipped ${skipped} existing.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
