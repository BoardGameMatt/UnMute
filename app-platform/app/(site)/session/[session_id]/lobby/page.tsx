import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SessionLobbyView } from "@/components/session/session-lobby-view";
import { PARTICIPANT_COOKIE } from "@/lib/constants";
import { getProtocol } from "@/lib/protocols";
import { buildJoinUrl, resolveAppOrigin } from "@/lib/session/app-origin";
import { mapSessionParticipantRows } from "@/lib/session/map-lobby-participants";
import { createClient } from "@/lib/supabase/server";

type SessionLobbyPageProps = {
  params: { session_id: string };
};

type ProtocolEmbed = {
  slug: string;
  name: string;
};

function protocolFromSession(session: {
  protocols: ProtocolEmbed | ProtocolEmbed[] | null;
}): { slug: string; name: string } {
  const raw = session.protocols;
  if (raw == null) {
    return { slug: "", name: "Session" };
  }
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== "object") {
    return { slug: "", name: "Session" };
  }
  return {
    slug: row.slug ?? "",
    name: row.name ?? "Session",
  };
}

export default async function SessionLobbyPage({ params }: SessionLobbyPageProps) {
  const sessionId = params.session_id;
  const supabase = createClient();

  const { data: session, error: sessionErr } = await supabase
    .from("sessions")
    .select("id, join_code, status, protocols ( slug, name )")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionErr || !session) {
    redirect("/join");
  }

  const sessionRecord = session as {
    join_code: string;
    status: string;
    protocols: ProtocolEmbed | ProtocolEmbed[] | null;
  };

  if (sessionRecord.status !== "lobby") {
    redirect(`/session/${sessionId}`);
  }

  const { slug: protocolSlug, name: protocolName } =
    protocolFromSession(sessionRecord);
  const LobbyExplainer = getProtocol(protocolSlug)?.lobbyExplainer;

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
        joinUrl={buildJoinUrl(resolveAppOrigin(headers()), sessionRecord.join_code)}
        initialParticipants={participants}
        currentRole={currentRole}
        currentParticipantId={participantId}
        LobbyExplainer={LobbyExplainer}
      />
    </main>
  );
}
