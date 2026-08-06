"use client";

import { WaoItemButton } from "./WaoItemButton";
import { WaoPlayTimer } from "./WaoPlayTimer";
import { useWaoPairPlay } from "@/lib/wao/use-wao-pair-play";

type WaoPlayViewProps = {
  sessionId: string;
  participantId: string;
};

export function WaoPlayView({ sessionId, participantId }: WaoPlayViewProps) {
  const play = useWaoPairPlay(sessionId, participantId);

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
            "Your pair will appear here once the facilitator starts play."}
        </p>
        <button
          type="button"
          onClick={() => void play.reload()}
          className="rounded-md border border-cloud-grey px-4 py-2 font-display text-sm font-semibold text-unmute-navy hover:bg-cloud-grey"
        >
          Check again
        </button>
      </main>
    );
  }

  const state = play.state;
  if (!state) return null;

  const waitingOnPartner =
    Boolean(state.myLockedAt) && !state.lockedAt && !state.isSolo;
  const partnerLocked =
    Boolean(state.partnerLockedAt) && !state.myLockedAt && !state.lockedAt;

  return (
    <main className="min-h-screen bg-warm-white pb-28">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-6 sm:px-6">
        <header className="space-y-3 text-center">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-steel-blue">
            Wrong Answers Only
            {state.isSolo ? " · Solo" : ""}
          </p>
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
          {play.phase === "settling" || play.phase === "locked" ? null : (
            <WaoPlayTimer
              durationSeconds={state.timerSeconds}
              startedAt={state.startedAt}
              onComplete={play.onTimerComplete}
            />
          )}
          {play.phase === "settling" ? (
            <p className="font-body text-sm text-slate">Locking in…</p>
          ) : null}
          {play.phase === "locked" ? (
            <p className="font-display text-lg font-semibold text-unmute-navy">
              Locked
            </p>
          ) : null}
        </div>

        {partnerLocked ? (
          <p
            className="rounded-lg border border-cloud-grey bg-cloud-grey/40 px-4 py-2 text-center font-body text-sm text-charcoal"
            role="status"
          >
            Your partner has locked in.
          </p>
        ) : null}
        {waitingOnPartner ? (
          <p
            className="rounded-lg border border-cloud-grey bg-cloud-grey/40 px-4 py-2 text-center font-body text-sm text-charcoal"
            role="status"
          >
            Waiting for your partner to lock in…
          </p>
        ) : null}

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

      {play.phase !== "locked" ? (
        <div className="fixed inset-x-0 bottom-0 border-t border-cloud-grey bg-warm-white/95 px-4 py-4 backdrop-blur-sm">
          <div className="mx-auto max-w-lg">
            <button
              type="button"
              disabled={
                play.inputDisabled ||
                play.phase === "settling" ||
                Boolean(state.myLockedAt)
              }
              onClick={() => void play.lockIn()}
              className="w-full rounded-md bg-signal-amber px-6 py-4 font-display text-lg font-semibold text-deep-navy shadow-sm transition hover:bg-sunrise-gold disabled:cursor-not-allowed disabled:opacity-40"
            >
              {state.myLockedAt ? "Locked in" : "Lock It In"}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
