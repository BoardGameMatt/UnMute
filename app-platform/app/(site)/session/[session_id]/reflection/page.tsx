import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SessionReflectionView } from "@/components/session/session-reflection-view";
import { PARTICIPANT_COOKIE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: { session_id: string } | Promise<{ session_id: string }>;
};

export const dynamic = "force-dynamic";

/**
 * Season reflection close — final screen after NPS (WAO, Cover Story).
 * Display-only prompts; nothing stored.
 */
export default async function SessionReflectionPage({ params }: PageProps) {
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
    .select("id, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionErr || !session) {
    redirect("/join");
  }

  if (session.status !== "completed") {
    redirect(`/session/${sessionId}`);
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

  return <SessionReflectionView />;
}
