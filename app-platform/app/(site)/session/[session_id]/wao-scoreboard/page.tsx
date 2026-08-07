import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WaoSessionScoreboard } from "@/lib/protocols/wrong-answers-only/components/WaoSessionScoreboard";
import { PARTICIPANT_COOKIE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: { session_id: string } | Promise<{ session_id: string }>;
};

export const dynamic = "force-dynamic";

/**
 * WAO post-session scoreboard. Requires completed session; then continue
 * to NPS, then reflection as the final screen.
 */
export default async function WaoScoreboardPage({ params }: PageProps) {
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
    .select("id, status, protocol_id, protocols ( slug )")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionErr || !session) {
    redirect("/join");
  }

  if (session.status !== "completed") {
    redirect(`/session/${sessionId}`);
  }

  const protocols = session.protocols as
    | { slug: string }
    | { slug: string }[]
    | null;
  const slug = Array.isArray(protocols)
    ? protocols[0]?.slug
    : protocols?.slug;
  if (slug !== "wrong-answers-only") {
    redirect(`/session/${sessionId}/feedback`);
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

  return <WaoSessionScoreboard sessionId={sessionId} />;
}
