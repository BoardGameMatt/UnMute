"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ComponentType,
} from "react";
import {
  startSessionAction,
  transferLeadAction,
} from "@/app/(site)/session/[session_id]/lobby/actions";
import { SessionJoinQr } from "@/components/session/session-join-qr";
import { JOIN_URL_DISPLAY } from "@/lib/constants";
import { useSessionParticipants } from "@/hooks/useSessionParticipants";
import { createClient } from "@/lib/supabase/client";
import type { LobbyParticipant } from "@/lib/types/lobby";
import { isSharedScreenName } from "@/lib/protocols/rank-and-file/engine";

type SessionLobbyViewProps = {
  sessionId: string;
  protocolName: string;
  protocolSlug?: string;
  minPlayers?: number;
  joinCode: string;
  joinUrl: string;
  initialParticipants: LobbyParticipant[];
  currentRole: "lead" | "member" | null;
  currentParticipantId: string | null;
  /** Optional per-protocol teaching slot (below QR, above roster). */
  LobbyExplainer?: ComponentType;
  LobbyLeadControls?: ComponentType<{ sessionId: string }>;
};

export function SessionLobbyView({
  sessionId,
  protocolName,
  protocolSlug,
  minPlayers = 3,
  joinCode,
  joinUrl,
  initialParticipants,
  currentRole,
  currentParticipantId,
  LobbyExplainer,
  LobbyLeadControls,
}: SessionLobbyViewProps) {
  const router = useRouter();
  const participants = useSessionParticipants(sessionId, initialParticipants);
  const supabase = useMemo(() => createClient(), []);
  const [startError, setStartError] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isStarting, setIsStarting] = useState(false);
  const [transferringId, setTransferringId] = useState<string | null>(null);
  const [shareAckOpen, setShareAckOpen] = useState(false);

  // Cover Story: floor is 2 members plus the facilitator (who also plays).
  const participantCount =
    protocolSlug === "cover-story"
      ? participants.filter((p) => p.roleInSession !== "lead").length
      : protocolSlug === "rank-and-file"
        ? participants.filter((p) => !isSharedScreenName(p.displayName)).length
        : participants.length;
  const hasEnoughToStart = participantCount >= minPlayers;
  const rosterParticipants =
    protocolSlug === "rank-and-file"
      ? participants.filter((p) => !isSharedScreenName(p.displayName))
      : participants;
  const canStart =
    currentRole === "lead" && !isPending && !isStarting && hasEnoughToStart;
  const hasLead = participants.some((p) => p.roleInSession === "lead");
  const leadName =
    participants.find((p) => p.roleInSession === "lead")?.displayName ?? null;
  const joinHintHost = useMemo(() => {
    try {
      const host = new URL(joinUrl).host;
      return host ? `${host}/join` : JOIN_URL_DISPLAY;
    } catch {
      return JOIN_URL_DISPLAY;
    }
  }, [joinUrl]);

  // After transferring lead away, this client is no longer lead — refresh role.
  useEffect(() => {
    if (currentRole !== "lead" || !currentParticipantId) return;
    const me = participants.find((p) => p.participantId === currentParticipantId);
    if (me && me.roleInSession !== "lead") {
      router.refresh();
    }
  }, [participants, currentRole, currentParticipantId, router]);

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

  // New lead (after transfer) should see Start; refresh when our row becomes lead.
  useEffect(() => {
    if (currentRole === "lead" || !currentParticipantId) return;
    const me = participants.find((p) => p.participantId === currentParticipantId);
    if (me?.roleInSession === "lead") {
      router.refresh();
    }
  }, [participants, currentRole, currentParticipantId, router]);

  // Always display uppercase — stored codes are uppercase, but never trust case.
  const chars = joinCode.toUpperCase().split("");

  const handleStart = () => {
    setStartError(null);
    setIsStarting(true);
    setShareAckOpen(false);
    startTransition(async () => {
      const result = await startSessionAction(sessionId);
      if (result && "error" in result && result.error) {
        setIsStarting(false);
        setStartError(result.error);
      }
    });
  };

  const handleStartClick = () => {
    if (protocolSlug === "code-switch") {
      setStartError(null);
      setShareAckOpen(true);
      return;
    }
    handleStart();
  };

  const handleMakeLead = (targetParticipantId: string) => {
    setTransferError(null);
    setTransferringId(targetParticipantId);
    startTransition(async () => {
      const result = await transferLeadAction(sessionId, targetParticipantId);
      setTransferringId(null);
      if (result && "error" in result && result.error) {
        setTransferError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-5 py-10 sm:px-8 sm:py-14">
      <header className="space-y-2 text-center">
        <h1 className="font-display text-3xl font-bold leading-tight text-deep-navy sm:text-4xl">
          {protocolName}
        </h1>
      </header>

      {currentRole === "lead" ? (
        <section
          className="rounded-lg border border-cloud-grey bg-warm-white p-6 shadow-sm sm:p-7"
          aria-label="Join code for projector"
        >
          <p className="mb-4 text-center font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
            Join code: show on projector
          </p>
          <SessionJoinQr joinUrl={joinUrl} />
          <div className="mb-4 flex flex-wrap justify-center gap-2 sm:gap-3">
            {chars.map((char, i) => (
              <div
                key={`${char}-${i}`}
                className="flex h-14 min-w-[44px] items-center justify-center rounded-lg border-2 border-cloud-grey bg-warm-white px-2 font-mono text-2xl font-medium uppercase tracking-widest text-deep-navy sm:h-16 sm:min-w-[52px] sm:text-[28px] sm:leading-none"
              >
                {char}
              </div>
            ))}
          </div>
          <p className="text-center font-body text-sm text-slate">
            <span className="font-body">Can&apos;t scan? Go to </span>
            <span className="font-mono text-unmute-navy">{joinHintHost}</span>
            <span className="font-body"> and enter this code</span>
          </p>
        </section>
      ) : (
        <p className="text-center font-body text-base text-slate">
          You&apos;re in the room. Wait for the facilitator to start.
        </p>
      )}

      {LobbyExplainer ? <LobbyExplainer /> : null}

      {currentRole === "lead" && LobbyLeadControls ? (
        <LobbyLeadControls sessionId={sessionId} />
      ) : null}

      <section aria-label="Participants">
        <h2 className="mb-4 font-mono text-xs font-medium uppercase tracking-widest text-steel-blue">
          In the room
        </h2>
        <ul className="flex flex-col gap-3">
          {rosterParticipants.map((p) => (
            <li
              key={p.sessionParticipantId}
              className="flex items-center justify-between gap-3 rounded-lg border border-cloud-grey bg-warm-white px-4 py-3 shadow-sm"
            >
              <span className="font-body text-lg text-charcoal">
                {p.displayName}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                {p.roleInSession === "lead" ? (
                  <span className="rounded-full bg-signal-amber/15 px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-widest text-unmute-navy">
                    Lead
                  </span>
                ) : currentRole === "lead" && protocolSlug !== "rank-and-file" ? (
                  <button
                    type="button"
                    disabled={isPending || transferringId === p.participantId}
                    onClick={() => handleMakeLead(p.participantId)}
                    className="rounded-md border border-cloud-grey px-3 py-1.5 font-display text-xs font-semibold text-unmute-navy transition-colors hover:bg-cloud-grey disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {transferringId === p.participantId
                      ? "Transferring…"
                      : "Make this person lead"}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        {transferError ? (
          <p className="mt-3 text-center text-sm text-signal-red" role="alert">
            {transferError}
          </p>
        ) : null}
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
            onClick={handleStartClick}
            className="w-full max-w-md rounded-md bg-signal-amber px-6 py-4 font-display text-lg font-semibold text-deep-navy shadow-sm transition hover:bg-sunrise-gold disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isStarting
              ? "Starting…"
              : protocolSlug === "talk-track"
                ? "Start demo"
                : "Start session"}
          </button>
          <p className="max-w-md text-center font-body text-sm text-slate">
            {protocolSlug === "talk-track" && hasEnoughToStart
              ? "Once everyone has joined, explain how Talk Track works. Then start the demo — you will be the guesser."
              : hasEnoughToStart
              ? "Do not press Start until everyone has joined."
              : protocolSlug === "i-know-what-you-meme" || protocolSlug === "rank-and-file"
                ? "Need 3 to start."
              : protocolSlug === "code-switch"
                ? "Need 4 to start."
              : `Start unlocks when at least ${minPlayers} ${
                  protocolSlug === "cover-story" ? "players" : "people"
                } have joined. ${participantCount} here so far.`}
          </p>
        </div>
      ) : !hasLead ? (
        <div className="mx-auto max-w-md space-y-3 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-steel-blue">
            Waiting on facilitator
          </p>
          <p className="font-body text-base text-slate">
            You&apos;re in the room. The facilitator has a private host link.
            Once they open it, they become lead and can start the session.
          </p>
        </div>
      ) : currentRole === "member" ? (
        <p className="text-center font-body text-base text-slate">
          Waiting for{" "}
          {protocolSlug === "rank-and-file"
            ? "the facilitator"
            : leadName ?? "the lead"}{" "}
          to start.
        </p>
      ) : (
        <p className="text-center font-body text-base text-slate">
          Could not determine your role in this session.
        </p>
      )}

      {shareAckOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-deep-navy px-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="switchcode-share-ack-title"
        >
          <div className="w-full max-w-lg text-center">
            <p className="font-mono text-[11px] font-medium uppercase tracking-widest text-sunrise-gold">
              Before you start
            </p>
            <h2
              id="switchcode-share-ack-title"
              className="mt-4 font-display text-4xl font-bold leading-tight text-warm-white sm:text-5xl"
            >
              Stop sharing your screen
            </h2>
            <p className="mt-5 font-body text-lg leading-relaxed text-warm-white">
              The secret word is about to appear on phones. Anyone still watching
              a shared screen will see it.
            </p>
            <button
              type="button"
              disabled={isStarting || isPending}
              onClick={handleStart}
              className="mt-8 w-full rounded-md bg-signal-amber px-6 py-4 font-display text-lg font-semibold text-deep-navy transition-colors hover:bg-sunrise-gold disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isStarting ? "Starting…" : "I have stopped sharing"}
            </button>
            <button
              type="button"
              disabled={isStarting || isPending}
              onClick={() => setShareAckOpen(false)}
              className="mt-3 w-full rounded-md border border-steel-blue px-6 py-3 font-display text-base font-semibold text-warm-white transition-colors hover:bg-unmute-navy disabled:cursor-not-allowed disabled:opacity-40"
            >
              Back
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
