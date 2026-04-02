import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SessionFeedbackForm } from "@/components/session/session-feedback-form";
import { PARTICIPANT_COOKIE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

type FeedbackPageProps = {
  params: { session_id: string };
};

export default async function SessionFeedbackPage({ params }: FeedbackPageProps) {
  const sessionId = params.session_id;
  const supabase = createClient();

  const { data: session, error: sessionErr } = await supabase
    .from("sessions")
    .select("id, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionErr || !session) {
    redirect("/join");
  }

  if (session.status !== "completed") {
    redirect(`/session/${sessionId}`);
  }

  const cookieStore = cookies();
  const participantId = cookieStore.get(PARTICIPANT_COOKIE)?.value ?? null;

  if (!participantId) {
    redirect("/join");
  }

  const { data: link } = await supabase
    .from("session_participants")
    .select("id")
    .eq("session_id", sessionId)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (!link) {
    redirect("/join");
  }

  const { data: existing } = await supabase
    .from("session_feedback")
    .select("id")
    .eq("session_id", sessionId)
    .eq("participant_id", participantId)
    .maybeSingle();

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
            <SessionFeedbackForm sessionId={sessionId} />
          )}
        </div>
      </div>
    </main>
  );
}
