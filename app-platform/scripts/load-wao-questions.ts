/**
 * Load wao-questions.json into wao_questions / wao_question_items.
 * Run from app-platform: npm run load:wao
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * Runs the validator first and refuses to load on any failure.
 * Additive and idempotent: skips category_title values already present.
 * Never deletes or truncates.
 */

import { config } from "dotenv";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env.local") });

const DEFAULT_LIBRARY_PATH = "supabase/seed-data/wao-questions.json";
const SUPPORTED_SCHEMA_VERSION = 1;

type LibraryItem = {
  label: string;
  is_correct: boolean;
  trap_tier: string;
  source_1_url: string | null;
  source_1_note: string | null;
  source_2_url: string | null;
  source_2_note: string | null;
};

type LibraryQuestion = {
  category_title: string;
  disambiguation_rule: string;
  disambiguation_detail: string | null;
  correct_count: number;
  difficulty: number;
  region_tag: string;
  pinned: boolean;
  active: boolean;
  items: LibraryItem[];
};

type LibraryFile = {
  schema_version: number;
  protocol?: string;
  questions: LibraryQuestion[];
};

function runValidator(libraryPath: string): void {
  console.log(`Validating ${libraryPath}…`);
  const tsxBin = resolve(process.cwd(), "node_modules/.bin/tsx");
  const result = spawnSync(
    tsxBin,
    ["scripts/validate-wao-questions.ts", libraryPath],
    {
      cwd: process.cwd(),
      stdio: "inherit",
      env: process.env,
    }
  );

  if (result.error) {
    console.error("Could not run validator:", result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error("Validator failed. Refusing to load.");
    process.exit(result.status ?? 1);
  }
}

function loadLibrary(libraryPath: string): LibraryFile {
  const raw = readFileSync(resolve(process.cwd(), libraryPath), "utf8");
  const parsed = JSON.parse(raw) as LibraryFile;

  if (!Number.isInteger(parsed.schema_version)) {
    console.error("schema_version is missing or not an integer.");
    process.exit(1);
  }
  if (parsed.schema_version !== SUPPORTED_SCHEMA_VERSION) {
    console.error(
      `Unsupported schema_version ${parsed.schema_version}; this loader knows ${SUPPORTED_SCHEMA_VERSION}.`
    );
    process.exit(1);
  }
  if (!Array.isArray(parsed.questions)) {
    console.error("questions is missing or not an array.");
    process.exit(1);
  }

  return parsed;
}

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

  runValidator(libraryPath);

  const library = loadLibrary(libraryPath);
  const supabase = createServiceClient();

  let questionsInserted = 0;
  let itemsInserted = 0;
  let questionsSkipped = 0;

  console.log(
    `Loading ${library.questions.length} question(s) from ${libraryPath}…`
  );

  for (const question of library.questions) {
    const title = question.category_title;

    const { data: existing, error: lookupErr } = await supabase
      .from("wao_questions")
      .select("id")
      .eq("category_title", title)
      .maybeSingle();

    if (lookupErr) {
      console.error(`Lookup failed for "${title}":`, lookupErr.message);
      process.exit(1);
    }

    if (existing) {
      console.log(`Skip (already present): ${title}`);
      questionsSkipped += 1;
      continue;
    }

    const { data: insertedQuestion, error: questionErr } = await supabase
      .from("wao_questions")
      .insert({
        category_title: title,
        disambiguation_rule: question.disambiguation_rule,
        disambiguation_detail: question.disambiguation_detail,
        correct_count: question.correct_count,
        difficulty: question.difficulty,
        region_tag: question.region_tag,
        pinned: question.pinned,
        active: question.active,
      })
      .select("id")
      .maybeSingle();

    if (questionErr || !insertedQuestion) {
      console.error(
        `Insert failed for "${title}":`,
        questionErr?.message ?? "no row returned"
      );
      process.exit(1);
    }

    const questionId = insertedQuestion.id as string;
    questionsInserted += 1;

    const itemRows = question.items.map((item) => ({
      question_id: questionId,
      label: item.label,
      is_correct: item.is_correct,
      trap_tier: item.trap_tier,
      source_1_url: item.source_1_url,
      source_1_note: item.source_1_note,
      source_2_url: item.source_2_url,
      source_2_note: item.source_2_note,
    }));

    const { error: itemsErr } = await supabase
      .from("wao_question_items")
      .insert(itemRows);

    if (itemsErr) {
      console.error(
        `Item insert failed for "${title}" (question row ${questionId} was created):`,
        itemsErr.message
      );
      process.exit(1);
    }

    itemsInserted += itemRows.length;
    console.log(`Inserted: ${title} (${itemRows.length} items)`);
  }

  console.log("");
  console.log(
    `Done. Inserted ${questionsInserted} question(s) and ${itemsInserted} item(s). Skipped ${questionsSkipped} existing question(s).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
