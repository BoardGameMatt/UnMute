"use client";

import type { SessionParticipantRole } from "@/lib/types/database";
import { WaoItemButton } from "./WaoItemButton";
import { WaoPlayTimer } from "./WaoPlayTimer";
import { WaoRevealView } from "./WaoRevealView";
import { useWaoPairPlay } from "@/lib/wao/use-wao-pair-play";

type WaoPlayViewProps = {
  sessionId: string;
  participantId: string;
  role: SessionParticipantRole;
};

export function WaoPlayView({
  sessionId,
  participantId,
  role,
}: WaoPlayViewProps) {
  const play = useWaoPairPlay(sessionId, participantId, {
    isLead: role === "lead",
  });

  if (play.phase === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-warm-white px-5">
        <p className="font-body text-slate">Loading round…</p>
      </main>
    );
  }

  if (play.phase === "waiting" || (play.phase === "error" && !play.state)) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-warm-white px-5">
        <p className="font-mono text-xs uppercase tracking-widest text-steel-blue">
          Wrong Answers Only
        </p>
        <h1 className="font-display text-2xl font-bold text-unmute-navy">
          Waiting for the round
        </h1>
        <p className="max-w-sm text-center font-body text-slate">
          {play.error ??
            (play.isLead
              ? "Start the round when everyone is in the room."
              : "Your pair will appear here once the facilitator starts play.")}
        </p>
        {play.startError ? (
          <p className="max-w-sm text-center font-body text-sm text-signal-red" role="alert">
            {play.startError}
          </p>
        ) : null}
        {play.isLead ? (
          <button
            type="button"
            disabled={play.starting}
            onClick={() => void play.startRound()}
            className="w-full max-w-xs rounded-md bg-signal-amber px-6 py-4 font-display text-lg font-semibold text-deep-navy shadow-sm transition hover:bg-sunrise-gold disabled:cursor-not-allowed disabled:opacity-40"
          >
            {play.starting ? "Starting…" : "Start round"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void play.reload()}
            className="rounded-md border border-cloud-grey px-4 py-2 font-display text-sm font-semibold text-unmute-navy hover:bg-cloud-grey"
          >
            Check again
          </button>
        )}
        {play.isLead && process.env.NODE_ENV !== "production" ? (
          <p className="max-w-sm text-center font-body text-xs text-slate">
            Dev: start draws inactive test questions (includeInactive).
          </p>
        ) : null}
      </main>
    );
  }

  if (play.phase === "locked") {
    if (play.reveal) {
      return <WaoRevealView reveal={play.reveal} />;
    }
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-warm-white px-5">
        <p className="font-display text-lg font-semibold text-unmute-navy">
          Time&apos;s up
        </p>
        <p className="font-body text-slate">
          {play.revealLoading
            ? "Scoring your round…"
            : play.revealError ?? "Loading reveal…"}
        </p>
        {play.revealError ? (
          <button
            type="button"
            onClick={() => void play.reload()}
            className="rounded-md border border-cloud-grey px-4 py-2 font-display text-sm font-semibold text-unmute-navy hover:bg-cloud-grey"
          >
            Try again
          </button>
        ) : null}
      </main>
    );
  }

  const state = play.state;
  if (!state) return null;

  const showTimer = play.phase === "playing" || play.phase === "settling";

  return (
    <main className="min-h-screen bg-warm-white">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-6 sm:px-6">
        <header className="space-y-3 text-center">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-steel-blue">
            Wrong Answers Only
          </p>
          {state.isSolo ? (
            <p className="font-body text-sm text-slate">
              Solo round — half value. No partner this time.
            </p>
          ) : (
            <p className="font-body text-base text-charcoal">
              Paired with{" "}
              <span className="font-display font-semibold text-unmute-navy">
                {state.partnerDisplayName ?? "your partner"}
              </span>
            </p>
          )}
          <h1 className="font-display text-2xl font-bold leading-tight text-unmute-navy sm:text-3xl">
            {state.categoryTitle}
          </h1>
          <p className="font-body text-base font-semibold text-charcoal">
            {state.disambiguationRule}
          </p>
          {state.disambiguationDetail ? (
            <p className="font-body text-sm text-slate">
              {state.disambiguationDetail}
            </p>
          ) : null}
          <p className="font-mono text-xs uppercase tracking-widest text-steel-blue">
            No searching. No chat.
          </p>
        </header>

        <div className="flex flex-col items-center gap-2">
          {showTimer ? (
            <WaoPlayTimer
              durationSeconds={Number(state.timerSeconds)}
              startedAt={state.startedAt}
              onComplete={play.onTimerComplete}
            />
          ) : null}
          {play.phase === "settling" ? (
            <p className="font-body text-sm text-slate">Locking in…</p>
          ) : null}
        </div>

        {play.syncWarning ? (
          <p className="text-center font-body text-sm text-signal-red" role="status">
            {play.syncWarning}
          </p>
        ) : null}

        <ul className="flex flex-col gap-2.5" aria-label="Answer options">
          {state.items.map((item) => (
            <li key={item.id}>
              <WaoItemButton
                label={item.label}
                state={play.itemStates.get(item.id) ?? "unselected"}
                myInitial={play.myInitial}
                partnerInitial={play.partnerInitial}
                unconfirmed={play.unconfirmedItemIds.has(item.id)}
                disabled={play.inputDisabled}
                onToggle={() => void play.sendTap(item.id)}
              />
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
