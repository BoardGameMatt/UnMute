"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { WaoPlayTimer } from "@/lib/protocols/wrong-answers-only/components/WaoPlayTimer";
import type { AirtimeAction, AirtimePlayState } from "../types";
import { AirtimeBoatsGraphic } from "./AirtimeBoatsGraphic";
import { BANNER, Banner, END_BANNER, ProtocolLabel, RulesCard, isBefore } from "./AirtimeChrome";
import { AirtimeFinal } from "./AirtimeFinal";
import { AirtimeResults } from "./AirtimeResults";
import { AirtimeTurnTimer } from "./AirtimeTurnTimer";

type Props = {
  state: AirtimePlayState;
  now: number;
  clockOffsetMs: number;
  pending: boolean;
  send: (action: AirtimeAction) => Promise<boolean>;
};

const BTN = "rounded-md px-6 py-3 font-display text-lg font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40";
const AMBER = `${BTN} bg-signal-amber text-deep-navy hover:bg-sunrise-gold`;
const NAVY = `${BTN} bg-unmute-navy text-warm-white hover:bg-deep-navy`;
const GHOST = `${BTN} border border-cloud-grey bg-transparent text-unmute-navy hover:bg-cloud-grey`;

function Controls({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-cloud-grey pt-6">
      <p className="mb-3 font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">Facilitator</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

export function AirtimeSharedScreen({ state, now, clockOffsetMs, pending, send }: Props) {
  const router = useRouter();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmFinal, setConfirmFinal] = useState(false);
  const swap = (a: string, b: string) => void send({ type: "swap", a, b });
  const expire = () => void send({ type: "timerExpired" });

  if (state.phase === "boats") {
    return (
      <div className="space-y-8">
        <ProtocolLabel />
        <h2 className="font-display text-3xl font-semibold text-unmute-navy">Your boats</h2>
        <AirtimeBoatsGraphic boats={state.boats} swapMode pending={pending} onSwap={swap} />
        <Controls>
          <button type="button" className={AMBER} disabled={pending} onClick={() => void send({ type: "showRules" })}>
            Show rules
          </button>
        </Controls>
      </div>
    );
  }

  if (state.phase === "rules") {
    return (
      <div className="space-y-8">
        <ProtocolLabel />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-3xl font-semibold text-unmute-navy">The rules</h2>
              {state.rulesStartedAt ? (
                <WaoPlayTimer
                  durationSeconds={state.rulesSeconds}
                  startedAt={state.rulesStartedAt}
                  onComplete={expire}
                  clockOffsetMs={clockOffsetMs}
                  retryMs={2000}
                  urgentBelowSeconds={0}
                  numericBelowSeconds={0}
                  size={72}
                />
              ) : null}
            </div>
            <RulesCard />
          </div>
          <AirtimeBoatsGraphic boats={state.boats} />
        </div>
        <Controls>
          <button type="button" className={AMBER} disabled={pending} onClick={() => void send({ type: "startDive" })}>
            Start dive 1
          </button>
        </Controls>
      </div>
    );
  }

  if (state.phase === "dive_active") {
    const showEndBanner = isBefore(now, state.endBannerUntil);
    return (
      <div className="space-y-8">
        <div className="flex items-start justify-between gap-6">
          <ProtocolLabel dive={state.diveNumber} />
          <AirtimeTurnTimer
            windowOpensAt={state.windowOpensAt}
            turnSeconds={state.turnSeconds}
            turn={state.turn}
            now={now}
            clockOffsetMs={clockOffsetMs}
            onExpire={expire}
            size={104}
          />
        </div>
        <Banner>{BANNER.shared}</Banner>
        {showEndBanner ? <Banner tone="amber">{END_BANNER}</Banner> : null}
        <AirtimeBoatsGraphic boats={state.boats} />
        <Controls>
          {state.endAfterTurn ? (
            <p className="font-body text-base text-slate">{END_BANNER}</p>
          ) : confirmEnd ? (
            <>
              <p className="font-body text-base text-charcoal">Anyone still underwater forfeits. End the dive?</p>
              <button
                type="button"
                className={NAVY}
                disabled={pending}
                onClick={() => {
                  setConfirmEnd(false);
                  void send({ type: "endAfterTurn" });
                }}
              >
                Yes, end after this turn
              </button>
              <button type="button" className={GHOST} onClick={() => setConfirmEnd(false)}>
                Keep diving
              </button>
            </>
          ) : (
            <button type="button" className={GHOST} disabled={pending} onClick={() => setConfirmEnd(true)}>
              End dive after this turn
            </button>
          )}
        </Controls>
      </div>
    );
  }

  if (state.phase === "dive_results" && state.results) {
    const lastDive = state.diveNumber >= state.maxDives;
    return (
      <div className="space-y-8">
        <ProtocolLabel dive={state.diveNumber} />
        <AirtimeResults results={state.results} meId={null} large />
        <Controls>
          {confirmFinal ? (
            <>
              <p className="font-body text-base text-charcoal">End the game and show the final score?</p>
              <button
                type="button"
                className={AMBER}
                disabled={pending}
                onClick={() => {
                  setConfirmFinal(false);
                  void send({ type: "finalScore" });
                }}
              >
                Yes, final score
              </button>
              <button type="button" className={GHOST} onClick={() => setConfirmFinal(false)}>
                Not yet
              </button>
            </>
          ) : (
            <>
              {lastDive ? (
                <p className="font-body text-base text-slate">Final dive complete.</p>
              ) : (
                <button type="button" className={NAVY} disabled={pending} onClick={() => void send({ type: "nextDive" })}>
                  Next dive
                </button>
              )}
              <button type="button" className={AMBER} disabled={pending} onClick={() => setConfirmFinal(true)}>
                Final score
              </button>
            </>
          )}
        </Controls>
      </div>
    );
  }

  if (state.phase === "final" && state.final) {
    return (
      <div className="space-y-8">
        <ProtocolLabel />
        <AirtimeFinal final={state.final} meId={null} large />
        <Controls>
          <button type="button" className={AMBER} disabled={pending} onClick={() => {
              void send({ type: "advanceRecap" }).then((ok) => {
                if (ok) router.replace(`/session/${state.sessionId}/feedback`);
              });
            }}
          >
            Continue
          </button>
        </Controls>
      </div>
    );
  }

  return <p className="font-body text-slate">Loading…</p>;
}
