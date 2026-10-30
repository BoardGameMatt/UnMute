"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type RecapEntry = {
  participantId: string;
  displayName: string;
  exactMatches: number;
};

type RecapPayload = {
  entries: RecapEntry[];
  teamHits: number;
  teamRounds: number;
};

function recapAdvancedFrom(stateJson: unknown): boolean {
  if (!stateJson || typeof stateJson !== "object" || Array.isArray(stateJson)) return false;
  const zoning = (stateJson as { zoningRights?: { recapAdvanced?: unknown } }).zoningRights;
  return zoning?.recapAdvanced === true;
}

export function ZoningRightsRecap({
  sessionId,
  isLead,
}: {
  sessionId: string;
  isLead: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState<RecapPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const goToNps = () => {
    router.replace(`/session/${sessionId}/feedback`);
  };

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/zoning-rights/session/${sessionId}/recap`)
      .then(async (res) => {
        const body = (await res.json()) as RecapPayload & { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Could not load recap.");
        if (!cancelled) setData(body);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load recap.");
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    const supabase = createClient();
    let navigated = false;
    const go = () => {
      if (navigated) return;
      navigated = true;
      goToNps();
    };

    const check = async () => {
      const { data: row } = await supabase
        .from("session_state")
        .select("state_json")
        .eq("session_id", sessionId)
        .maybeSingle();
      if (recapAdvancedFrom(row?.state_json)) go();
    };

    void check();
    const pollId = window.setInterval(() => {
      void check();
    }, 2500);

    const channel = supabase
      .channel(`zr_recap:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "session_state",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const next = payload.new as { state_json?: unknown } | null;
          if (recapAdvancedFrom(next?.state_json)) go();
        }
      )
      .subscribe();

    return () => {
      window.clearInterval(pollId);
      void supabase.removeChannel(channel);
    };
  }, [router, sessionId]);

  const onContinue = async () => {
    if (!isLead) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/zoning-rights/session/${sessionId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "advanceRecap" }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not continue.");
      goToNps();
    } catch (err: unknown) {
      setPending(false);
      setError(err instanceof Error ? err.message : "Could not continue.");
    }
  };

  return (
    <main className="min-h-screen bg-warm-white px-5 py-12">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-8">
        <header className="text-center">
          <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
            Zoning Rights
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-unmute-navy">Recap</h1>
        </header>

        {error ? (
          <p className="text-center font-body text-sm text-signal-red">{error}</p>
        ) : null}

        {data ? (
          <>
            <section className="rounded-lg border border-cloud-grey bg-warm-white p-6">
              <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
                Individual rounds
              </p>
              <ul className="mt-4 space-y-2">
                {data.entries.map((row) => (
                  <li key={row.participantId} className="flex justify-between font-body text-charcoal">
                    <span>{row.displayName}</span>
                    <span className="font-display text-lg text-unmute-navy">{row.exactMatches}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-lg border border-cloud-grey bg-warm-white p-6 text-center">
              <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
                Team play
              </p>
              <p className="mt-3 font-display text-3xl font-semibold text-unmute-navy">
                {data.teamHits} of {data.teamRounds}
              </p>
            </section>
          </>
        ) : (
          <p className="text-center font-body text-slate">Loading recap…</p>
        )}

        {isLead ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => void onContinue()}
            className="rounded-md bg-signal-amber px-6 py-3 text-center font-display text-base font-semibold text-deep-navy shadow-sm hover:bg-sunrise-gold disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue
          </button>
        ) : (
          <p className="text-center font-body text-sm text-slate">
            Waiting for the facilitator to continue.
          </p>
        )}
      </div>
    </main>
  );
}
