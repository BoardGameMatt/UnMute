import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ZoningRightsRecap } from "@/lib/protocols/zoning-rights/components/ZoningRightsRecap";
import { PARTICIPANT_COOKIE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: { session_id: string } | Promise<{ session_id: string }>;
};

export const dynamic = "force-dynamic";

export default async function ZoningRightsScoreboardPage({ params }: PageProps) {
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

  const protocols = session.protocols as { slug: string } | { slug: string }[] | null;
  const slug = Array.isArray(protocols) ? protocols[0]?.slug : protocols?.slug;
  if (slug !== "zoning-rights") {
    redirect(`/session/${sessionId}/feedback`);
  }

  const { data: link } = await supabase
    .from("session_participants")
    .select("id, role_in_session")
    .eq("session_id", sessionId)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (!link) {
    redirect("/join");
  }

  return (
    <ZoningRightsRecap
      sessionId={sessionId}
      isLead={link.role_in_session === "lead"}
    />
  );
}
