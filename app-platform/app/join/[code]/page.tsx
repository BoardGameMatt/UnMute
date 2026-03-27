import { cookies } from "next/headers";
import Link from "next/link";
import { ActiveSessionRejoin } from "@/components/join/active-session-rejoin";
import { LobbyGuestJoinForm } from "@/components/join/lobby-guest-join-form";
import { RequireAuthPanel } from "@/components/join/require-auth-panel";
import { createClient } from "@/lib/supabase/server";
import { PARTICIPANT_COOKIE } from "@/lib/constants";

type JoinCodePageProps = {
  params: { code: string };
};

export default async function JoinCodePage({ params }: JoinCodePageProps) {
  const raw = params.code ?? "";
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

  if (code.length !== 6) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="font-display text-3xl font-bold text-unmute-navy">
            Invalid or expired code
          </h1>
          <p className="font-body text-slate">
            Codes are exactly six letters or numbers.
          </p>
          <Link
            href="/join"
            className="inline-block font-display font-semibold text-unmute-navy underline underline-offset-4 hover:text-deep-navy"
          >
            Enter a new code
          </Link>
        </div>
      </main>
    );
  }

  const supabase = createClient();

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, status, team_id")
    .eq("join_code", code)
    .maybeSingle();

  if (sessionError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <p className="text-center text-signal-red" role="alert">
          Something went wrong. Try again.
        </p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="font-display text-3xl font-bold text-unmute-navy">
            Invalid or expired code
          </h1>
          <p className="font-body text-slate">
            We couldn&apos;t find a session with that code.
          </p>
          <Link
            href="/join"
            className="inline-block font-display font-semibold text-unmute-navy underline underline-offset-4 hover:text-deep-navy"
          >
            Try another code
          </Link>
        </div>
      </main>
    );
  }

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("require_auth")
    .eq("id", session.team_id)
    .single();

  if (teamError || !team) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <p className="text-center text-signal-red" role="alert">
          Could not load team settings.
        </p>
      </main>
    );
  }

  const cookieStore = cookies();
  const participantCookie = cookieStore.get(PARTICIPANT_COOKIE)?.value ?? null;

  let showRejoin = false;
  if (participantCookie && session.status === "active") {
    const { data: link } = await supabase
      .from("session_participants")
      .select("id")
      .eq("session_id", session.id)
      .eq("participant_id", participantCookie)
      .maybeSingle();
    showRejoin = !!link;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-lg flex-col items-center gap-10">
        {session.status === "completed" || session.status === "cancelled" ? (
          <div className="w-full max-w-md space-y-4 text-center">
            <h1 className="font-display text-3xl font-bold text-unmute-navy">
              This session has ended
            </h1>
            <p className="font-body text-lg text-slate">
              Thanks for playing. You can close this page.
            </p>
          </div>
        ) : null}

        {session.status === "active" ? (
          <ActiveSessionRejoin
            sessionId={session.id}
            showRejoin={showRejoin}
          />
        ) : null}

        {session.status === "lobby" && team.require_auth ? (
          <RequireAuthPanel />
        ) : null}

        {session.status === "lobby" && !team.require_auth ? (
          <div className="flex w-full flex-col items-center gap-8">
            <div className="space-y-2 text-center">
              <p className="font-mono text-xs uppercase tracking-widest text-steel-blue">
                You&apos;re joining
              </p>
              <h1 className="font-display text-3xl font-bold text-unmute-navy">
                Welcome
              </h1>
              <p className="font-body text-lg text-slate">
                Choose a display name your team will see in the room.
              </p>
            </div>
            <LobbyGuestJoinForm
              sessionId={session.id}
              teamId={session.team_id}
            />
          </div>
        ) : null}
      </div>
    </main>
  );
}
