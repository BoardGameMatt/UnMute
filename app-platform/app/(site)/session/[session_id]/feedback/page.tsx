import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SessionFeedbackForm } from "@/components/session/session-feedback-form";
import { PARTICIPANT_COOKIE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

type FeedbackPageProps = {
  params: { session_id: string } | Promise<{ session_id: string }>;
};

export const dynamic = "force-dynamic";

function protocolSlugFrom(
  protocols: { slug: string } | { slug: string }[] | null | undefined
): string {
  if (!protocols) return "";
  const row = Array.isArray(protocols) ? protocols[0] : protocols;
  return row?.slug ?? "";
}

export default async function SessionFeedbackPage({ params }: FeedbackPageProps) {
  const { session_id: rawSessionId } = await Promise.resolve(params);
  const sessionId = typeof rawSessionId === "string" ? rawSessionId.trim() : "";
  if (!sessionId) {
    redirect("/join");
  }

  const cookieStore = await cookies();
  const participantId = cookieStore.get(PARTICIPANT_COOKIE)?.value ?? null;

  if (!participantId) {
    redirect("/join");
  }

  const supabase = createClient();

  const { data: session, error: sessionErr } = await supabase
    .from("sessions")
    .select("id, status, protocols ( slug )")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionErr || !session) {
    redirect("/join");
  }

  if (session.status !== "completed") {
    redirect(`/session/${sessionId}`);
  }

  const isWao =
    protocolSlugFrom(
      session.protocols as { slug: string } | { slug: string }[] | null
    ) === "wrong-answers-only";

  const { data: link, error: linkErr } = await supabase
    .from("session_participants")
    .select("id")
    .eq("session_id", sessionId)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (linkErr) {
    redirect("/join");
  }

  if (!link) {
    redirect("/join");
  }

  const { data: existing, error: existingErr } = await supabase
    .from("session_feedback")
    .select("id")
    .eq("session_id", sessionId)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (existingErr) {
    redirect("/join");
  }

  // WAO: reflection is the final screen — never park on the NPS thank-you.
  if (isWao && existing) {
    redirect(`/session/${sessionId}/reflection`);
  }

  return (
    <main className="min-h-screen bg-warm-white px-5 py-14">
      <div className="mx-auto max-w-lg">
        <h1 className="text-center font-display text-3xl font-semibold text-unmute-navy">
          How was that?
        </h1>

        <div className="mt-12">
          {existing ? (
            <p className="text-center font-display text-xl font-semibold text-unmute-navy">
              Thanks for your feedback. See you next week.
            </p>
          ) : (
            <SessionFeedbackForm
              sessionId={sessionId}
              afterSubmitHref={
                isWao ? `/session/${sessionId}/reflection` : undefined
              }
            />
          )}
        </div>
      </div>
    </main>
  );
}
