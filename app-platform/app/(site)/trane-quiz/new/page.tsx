import { createServiceClient } from "@/lib/supabase/admin";
import { TraneNewForm } from "./trane-new-form";

export const dynamic = "force-dynamic";

export default async function TraneQuizNewPage() {
  const admin = createServiceClient();
  const { data: courses } = await admin
    .from("trane_courses")
    .select("slug, title")
    .order("title", { ascending: true });

  const list = (courses ?? []) as { slug: string; title: string }[];

  if (list.length === 0) {
    return (
      <main className="mx-auto max-w-lg px-5 py-16 text-center">
        <h1 className="text-2xl text-trane-purple">No courses seeded</h1>
        <p className="mt-3 text-sm text-trane-gray">
          Run the migration, then{" "}
          <code className="font-mono text-xs">npm run seed:trane-quiz</code> from
          app-platform.
        </p>
      </main>
    );
  }

  return (
    <main>
      <TraneNewForm courses={list} />
    </main>
  );
}
