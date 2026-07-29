import { unstable_noStore as noStore } from "next/cache";
import { cookies } from "next/headers";
import Link from "next/link";
import { HostClaimForm } from "@/components/join/host-claim-form";
import { createClient } from "@/lib/supabase/server";
import { PARTICIPANT_COOKIE } from "@/lib/constants";

type HostTokenPageProps = {
  params: { token: string };
};

export const dynamic = "force-dynamic";

export default async function HostTokenPage({ params }: HostTokenPageProps) {
  noStore();
  const token = (params.token ?? "").trim();

  if (!token || token.length < 32) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="font-display text-3xl font-bold text-unmute-navy">
            Invalid host link
          </h1>
          <p className="font-body text-slate">
            Ask your UnMute contact for a fresh facilitator link.
          </p>
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

  const supabase = createClient();
  const { data: session, error } = await supabase
    .from("sessions")
    .select("id, status, protocols ( name )")
    .eq("host_token", token)
    .maybeSingle();

  if (error || !session) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="font-display text-3xl font-bold text-unmute-navy">
            Host link not found
          </h1>
          <p className="font-body text-slate">
            This facilitator link is invalid or expired.
          </p>
        </div>
      </main>
    );
  }

  if (session.status === "completed" || session.status === "cancelled") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="font-display text-3xl font-bold text-unmute-navy">
            This session has ended
          </h1>
          <p className="font-body text-lg text-slate">
            Thanks for playing. You can close this page.
          </p>
        </div>
      </main>
    );
  }

  const protocolName = protocolNameFromSession(session);
  const cookieStore = cookies();
  const participantCookie = cookieStore.get(PARTICIPANT_COOKIE)?.value ?? null;

  let needsName = true;
  if (participantCookie) {
    const { data: link } = await supabase
      .from("session_participants")
      .select("id")
      .eq("session_id", session.id)
      .eq("participant_id", participantCookie)
      .maybeSingle();
    needsName = !link;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-lg flex-col items-center gap-8">
        <div className="space-y-2 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-steel-blue">
            Facilitator
          </p>
          <h1 className="font-display text-3xl font-bold text-unmute-navy">
            {protocolName}
          </h1>
          <p className="font-body text-lg text-slate">
            {needsName
              ? "Enter your name to take the lead for this session. Opening this link on another device transfers lead to that browser."
              : "You are already in this session on this device. Continue to take (or keep) the lead."}
          </p>
        </div>
        <HostClaimForm hostToken={token} needsName={needsName} />
      </div>
    </main>
  );
}

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
