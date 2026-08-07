"use client";

import { useRouter } from "next/navigation";
import type { SessionParticipantRole } from "@/lib/types/database";
import { WaoDisambiguationInfo } from "./WaoDisambiguationInfo";
import { WaoItemButton } from "./WaoItemButton";
import { WaoLeadAdvanceControls } from "./WaoLeadAdvanceControls";
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
  const router = useRouter();
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
        {play.stillTrying ? (
          <p className="max-w-sm text-center font-body text-xs text-slate">
            Still connecting… we&apos;ll keep trying.
          </p>
        ) : null}
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
      return (
        <WaoRevealView
          reveal={play.reveal}
          waitingHint={
            play.isLead
              ? null
              : "Waiting for the facilitator to start the next round or end the session…"
          }
          leadControls={
            play.isLead ? (
              <WaoLeadAdvanceControls
                status={play.facilitatorStatus}
                statusError={play.facilitatorStatusError}
                actionError={play.advanceError}
                startingNext={play.startingNext}
                ending={play.endingSession}
                onStartNext={() => {
                  void play.startNextRound();
                }}
                onEndSession={() => {
                  void (async () => {
                    const ok = await play.endSession();
                    if (ok) {
                      router.replace(`/session/${sessionId}/wao-scoreboard`);
                    }
                  })();
                }}
              />
            ) : null
          }
        />
      );
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
  const partnerName = state.partnerDisplayName ?? "your partner";

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
            <p className="flex items-center justify-center gap-2 font-body text-base text-charcoal">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-unmute-navy font-mono text-[10px] font-medium text-unmute-navy"
                aria-hidden
              >
                {play.partnerInitial}
              </span>
              <span>
                Paired with{" "}
                <span className="font-display font-semibold text-unmute-navy">
                  {partnerName}
                </span>
              </span>
            </p>
          )}

          <div className="flex items-start justify-center gap-2">
            <h1 className="font-display text-2xl font-bold leading-tight text-unmute-navy sm:text-3xl">
              {state.categoryTitle}
            </h1>
            <WaoDisambiguationInfo
              rule={state.disambiguationRule}
              detail={state.disambiguationDetail}
            />
          </div>

          <p className="font-display text-lg font-bold leading-snug text-unmute-navy sm:text-xl">
            {state.isSolo
              ? "Tap the answers you think are WRONG."
              : "Tap the answers you think are WRONG. Only what you and your partner BOTH tap counts as your answer."}
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
          <p className="font-mono text-xs uppercase tracking-widest text-steel-blue">
            No searching. No chat.
          </p>
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
