"use client";

import { WaoPlayTimer } from "@/lib/protocols/wrong-answers-only/components/WaoPlayTimer";
import type { AirtimePlayState } from "../types";
import { BoatCard, ProtocolLabel, RulesCard } from "./AirtimeChrome";

type Props = {
  state: AirtimePlayState;
  clockOffsetMs: number;
  onRulesExpire: () => void;
};

export function AirtimeBoatsAndRules({ state, clockOffsetMs, onRulesExpire }: Props) {
  const myBoat = state.boats.find((b) => b.id === state.myBoatId) ?? null;

  return (
    <div className="space-y-6">
      <ProtocolLabel />
      {myBoat ? (
        <BoatCard name={myBoat.name} members={myBoat.members} me={state.me?.participantId} />
      ) : (
        <p className="font-body text-base text-slate">You&apos;re watching this one.</p>
      )}

      {state.phase === "boats" ? (
        <p className="font-body text-base text-slate">The facilitator will show the rules next.</p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold text-unmute-navy">The rules</h2>
            {state.rulesStartedAt ? (
              <WaoPlayTimer
                durationSeconds={state.rulesSeconds}
                startedAt={state.rulesStartedAt}
                onComplete={onRulesExpire}
                clockOffsetMs={clockOffsetMs}
                retryMs={2000}
                urgentBelowSeconds={0}
                numericBelowSeconds={0}
                size={56}
              />
            ) : null}
          </div>
          <RulesCard />
        </>
      )}
    </div>
  );
}
