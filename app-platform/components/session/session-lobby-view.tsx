"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { startSessionAction } from "@/app/session/[session_id]/lobby/actions";
import { JOIN_URL_DISPLAY } from "@/lib/constants";
import { useSessionParticipants } from "@/hooks/useSessionParticipants";
import { createClient } from "@/lib/supabase/client";
import type { LobbyParticipant } from "@/lib/types/lobby";

type SessionLobbyViewProps = {
  sessionId: string;
  protocolName: string;
  joinCode: string;
  initialParticipants: LobbyParticipant[];
  currentRole: "lead" | "member" | null;
};

export function SessionLobbyView({
  sessionId,
  protocolName,
  joinCode,
  initialParticipants,
  currentRole,
}: SessionLobbyViewProps) {
  const router = useRouter();
  const participants = useSessionParticipants(sessionId, initialParticipants);
  const supabase = useMemo(() => createClient(), []);
  const [startError, setStartError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canStart =
    currentRole === "lead" && participants.length >= 2 && !isPending;

  useEffect(() => {
    if (currentRole !== "member") return;

    const channel = supabase
      .channel(`sessions_lobby:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const next = payload.new as { status?: string };
          if (next.status === "active") {
            router.replace(`/session/${sessionId}`);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentRole, sessionId, supabase, router]);

  const chars = joinCode.toUpperCase().split("");

  const handleStart = () => {
    setStartError(null);
    startTransition(async () => {
      const result = await startSessionAction(sessionId);
      if (result && "error" in result && result.error) {
        setStartError(result.error);
      }
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-5 py-10 sm:px-8 sm:py-14">
      <header className="space-y-2 text-center">
        <h1 className="font-display text-3xl font-bold leading-tight text-deep-navy sm:text-4xl">
          {protocolName}
        </h1>
      </header>

      <section
        className="rounded-lg border border-cloud-grey bg-warm-white p-6 shadow-sm sm:p-7"
        aria-label="Join code for projector"
      >
        <p className="mb-4 text-center font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-steel-blue">
          Join code — show on projector
        </p>
        <div className="mb-4 flex flex-wrap justify-center gap-2 sm:gap-3">
          {chars.map((char, i) => (
            <div
              key={`${char}-${i}`}
              className="flex h-14 min-w-[44px] items-center justify-center rounded-lg border-2 border-cloud-grey bg-warm-white px-2 font-mono text-2xl font-medium text-deep-navy sm:h-16 sm:min-w-[52px] sm:text-[28px] sm:leading-none"
            >
              {char}
            </div>
          ))}
        </div>
        <p className="text-center font-body text-sm text-slate">
          <span className="font-body">Go to </span>
          <span className="font-mono text-unmute-navy">{JOIN_URL_DISPLAY}</span>
          <span className="font-body"> and enter this code</span>
        </p>
      </section>

      <section aria-label="Participants">
        <h2 className="mb-4 font-mono text-xs font-medium uppercase tracking-widest text-steel-blue">
          In the room
        </h2>
        <ul className="flex flex-col gap-3">
          {participants.map((p) => (
            <li
              key={p.sessionParticipantId}
              className="flex items-center justify-between rounded-lg border border-cloud-grey bg-warm-white px-4 py-3 shadow-sm"
            >
              <span className="font-body text-lg text-charcoal">
                {p.displayName}
              </span>
              {p.roleInSession === "lead" ? (
                <span className="rounded-full bg-signal-amber/15 px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-widest text-unmute-navy">
                  Lead
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {currentRole === "lead" ? (
        <div className="flex flex-col items-center gap-3">
          {startError ? (
            <p className="text-center text-sm text-signal-red" role="alert">
              {startError}
            </p>
          ) : null}
          <button
            type="button"
            disabled={!canStart}
            onClick={handleStart}
            className="w-full max-w-md rounded-md bg-signal-amber px-6 py-4 font-display text-lg font-semibold text-deep-navy shadow-sm transition hover:bg-sunrise-gold disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? "Starting…" : "Start Session"}
          </button>
        </div>
      ) : currentRole === "member" ? (
        <p className="text-center font-body text-base text-slate">
          Waiting for lead to start…
        </p>
      ) : (
        <p className="text-center font-body text-base text-slate">
          Could not determine your role in this session.
        </p>
      )}
    </div>
  );
}
