/**
 * Seed Trane Quiz courses + questions from question-bank-v1.json.
 * Run from app-platform: npm run seed:trane-quiz
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * Idempotent: upserts courses by slug; replaces questions for each course.
 */

import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env.local") });

type BankOption = { key: string; label: string };
type BankQuestion = {
  sort_order: number;
  stem: string;
  options: BankOption[];
  correct_option: string;
};
type BankCourse = {
  slug: string;
  title: string;
  revision_label: string;
  questions: BankQuestion[];
};
type BankFile = { courses: BankCourse[] };

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const bankPath = resolve(
    process.cwd(),
    "lib/trane-quiz/question-bank-v1.json"
  );
  const bank = JSON.parse(readFileSync(bankPath, "utf8")) as BankFile;
  if (!Array.isArray(bank.courses) || bank.courses.length === 0) {
    throw new Error("question-bank-v1.json has no courses");
  }

  const admin = createClient(url, key);

  for (const course of bank.courses) {
    if (course.questions.length !== 10) {
      throw new Error(`${course.slug}: expected 10 questions`);
    }

    const { data: existing } = await admin
      .from("trane_courses")
      .select("id")
      .eq("slug", course.slug)
      .maybeSingle();

    let courseId: string;
    if (existing?.id) {
      courseId = existing.id as string;
      const { error } = await admin
        .from("trane_courses")
        .update({
          title: course.title,
          revision_label: course.revision_label,
        })
        .eq("id", courseId);
      if (error) throw error;
      const { error: delErr } = await admin
        .from("trane_questions")
        .delete()
        .eq("course_id", courseId);
      if (delErr) throw delErr;
    } else {
      const { data: inserted, error } = await admin
        .from("trane_courses")
        .insert({
          slug: course.slug,
          title: course.title,
          revision_label: course.revision_label,
        })
        .select("id")
        .single();
      if (error || !inserted) throw error ?? new Error("insert course failed");
      courseId = inserted.id as string;
    }

    const rows = course.questions.map((q) => ({
      course_id: courseId,
      sort_order: q.sort_order,
      stem: q.stem,
      options: q.options,
      correct_option: q.correct_option,
    }));

    const { error: qErr } = await admin.from("trane_questions").insert(rows);
    if (qErr) throw qErr;
    console.log(`Seeded ${course.slug} (${course.questions.length} questions)`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
