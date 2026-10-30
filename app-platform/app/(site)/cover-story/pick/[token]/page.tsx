import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { CoverStoryPickForm } from "@/components/cover-story/cover-story-pick-form";
import { loadPickPageByToken } from "@/lib/cover-story/pick-page";
import { createServiceClient } from "@/lib/supabase/admin";

type PickTokenPageProps = {
  params: { token: string };
};

export const dynamic = "force-dynamic";

export default async function CoverStoryPickPage({ params }: PickTokenPageProps) {
  noStore();
  const token = (params.token ?? "").trim();

  if (!token || token.length < 32) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="font-display text-3xl font-bold text-unmute-navy">Invalid pick link</h1>
          <p className="font-body text-slate">Ask your facilitator for a fresh private pick link.</p>
          <Link
            href="/join"
            className="inline-block font-display font-semibold text-unmute-navy underline underline-offset-4 hover:text-deep-navy"
          >
            Join with a code instead
          </Link>
        </div>
      </main>
    );
  }

  let data;
  try {
    const admin = createServiceClient();
    data = await loadPickPageByToken(admin, token);
  } catch {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <p className="font-body text-slate">Could not load this pick link.</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="font-display text-3xl font-bold text-unmute-navy">Pick link not found</h1>
          <p className="font-body text-slate">This link is invalid or expired.</p>
        </div>
      </main>
    );
  }

  if (data.sessionPhase === "complete") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="font-display text-3xl font-bold text-unmute-navy">Session complete</h1>
          <p className="font-body text-slate">This Cover Story session has ended.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <CoverStoryPickForm token={token} initial={data} />
    </main>
  );
}
