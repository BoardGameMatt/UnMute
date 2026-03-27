import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SessionLobbyView } from "@/components/session/session-lobby-view";
import { PARTICIPANT_COOKIE } from "@/lib/constants";
import { mapSessionParticipantRows } from "@/lib/session/map-lobby-participants";
import { createClient } from "@/lib/supabase/server";

type SessionLobbyPageProps = {
  params: { session_id: string };
};

function protocolNameFromSession(session: unknown): string {
  if (!session || typeof session !== "object") return "Session";
  const protocols = (session as { protocols?: unknown }).protocols;
  if (protocols == null) return "Session";
  if (Array.isArray(protocols)) {
    const p = protocols[0];
    if (p && typeof p === "object" && "name" in p) {
      return String((p as { name: string }).name) || "Session";
    }
    return "Session";
  }
  if (typeof protocols === "object" && "name" in protocols) {
    return String((protocols as { name: string }).name) || "Session";
  }
  return "Session";
}

export default async function SessionLobbyPage({ params }: SessionLobbyPageProps) {
  const sessionId = params.session_id;
  const supabase = createClient();

  const { data: session, error: sessionErr } = await supabase
    .from("sessions")
    .select("id, join_code, status, protocols ( name )")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionErr || !session) {
    redirect("/join");
  }

  const sessionRecord = session as {
    join_code: string;
    status: string;
  };

  if (sessionRecord.status !== "lobby") {
    redirect(`/session/${sessionId}`);
  }

  const protocolName = protocolNameFromSession(session);

  const { data: spRows, error: spErr } = await supabase
    .from("session_participants")
    .select(
      "id, role_in_session, participant_id, participants ( display_name )"
    )
    .eq("session_id", sessionId);

  if (spErr) {
    return (
      <main className="min-h-screen bg-warm-white px-5 py-12">
        <p className="text-center text-signal-red" role="alert">
          Could not load participants.
        </p>
      </main>
    );
  }

  const participants = mapSessionParticipantRows(
    spRows as Parameters<typeof mapSessionParticipantRows>[0]
  );

  const cookieStore = cookies();
  const participantId = cookieStore.get(PARTICIPANT_COOKIE)?.value ?? null;

  if (!participantId) {
    redirect("/join");
  }

  const { data: me } = await supabase
    .from("session_participants")
    .select("role_in_session")
    .eq("session_id", sessionId)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (!me) {
    return (
      <main className="min-h-screen bg-warm-white px-5 py-12">
        <div className="mx-auto max-w-md text-center">
          <h1 className="font-display text-2xl font-bold text-unmute-navy">
            Not in this session
          </h1>
          <p className="mt-3 font-body text-slate">
            Join with the session code first, then open this link again.
          </p>
        </div>
      </main>
    );
  }

  const roleRow = me as { role_in_session: string };
  const currentRole =
    roleRow.role_in_session === "lead"
      ? ("lead" as const)
      : roleRow.role_in_session === "member"
        ? ("member" as const)
        : null;

  return (
    <main className="min-h-screen bg-warm-white">
      <SessionLobbyView
        sessionId={sessionId}
        protocolName={protocolName}
        joinCode={sessionRecord.join_code}
        initialParticipants={participants}
        currentRole={currentRole}
      />
    </main>
  );
}
