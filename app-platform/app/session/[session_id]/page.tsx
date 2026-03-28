import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { PARTICIPANT_COOKIE } from "@/lib/constants";
import { getProtocol } from "@/lib/protocols";
import { createClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/types/database";

type SessionPageProps = {
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

export default async function SessionPage({ params }: SessionPageProps) {
  const sessionId = params.session_id;
  const supabase = createClient();

  const { data: session, error: sessionErr } = await supabase
    .from("sessions")
    .select(
      "id, protocol_id, team_id, status, join_code, started_at, completed_at, created_at, protocol_slot_id, protocols ( slug, name )"
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionErr || !session) {
    redirect("/join");
  }

  const sessionRow = session as typeof session & {
    protocols: ProtocolEmbed | ProtocolEmbed[] | null;
  };

  const { slug: protocolSlug, name: protocolName } = protocolFromSession(sessionRow);

  const cookieStore = cookies();
  const participantId = cookieStore.get(PARTICIPANT_COOKIE)?.value ?? null;

  if (!participantId) {
    redirect("/join");
  }

  const { data: sessionLink, error: linkErr } = await supabase
    .from("session_participants")
    .select("role_in_session")
    .eq("session_id", sessionId)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (linkErr) {
    return (
      <main className="min-h-screen bg-warm-white px-5 py-12">
        <p className="text-center text-signal-red" role="alert">
          Could not load your place in this session.
        </p>
      </main>
    );
  }

  if (!sessionLink) {
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

  const { data: participant, error: participantErr } = await supabase
    .from("participants")
    .select(
      "id, team_id, person_id, display_name, role, avatar_seed, joined_at"
    )
    .eq("id", participantId)
    .maybeSingle();

  if (participantErr || !participant) {
    return (
      <main className="min-h-screen bg-warm-white px-5 py-12">
        <p className="text-center text-signal-red" role="alert">
          Could not load participant profile.
        </p>
      </main>
    );
  }

  const definition = protocolSlug ? getProtocol(protocolSlug) : undefined;
  const role = sessionLink.role_in_session;

  return (
    <main className="min-h-screen bg-warm-white py-12">
      <SessionProvider
        session={sessionRow as Session}
        currentParticipant={participant}
        roleInSession={role}
        protocolName={protocolName}
      >
        {definition ? (
          <definition.component
            sessionId={sessionId}
            participantId={participantId}
            role={role}
            teamId={sessionRow.team_id}
          />
        ) : (
          <div className="mx-auto max-w-lg px-6 text-center">
            <h1 className="font-display text-2xl font-semibold text-unmute-navy">
              Protocol coming soon
            </h1>
            <p className="mt-3 font-body text-lg text-slate">{protocolName}</p>
          </div>
        )}
      </SessionProvider>
    </main>
  );
}
