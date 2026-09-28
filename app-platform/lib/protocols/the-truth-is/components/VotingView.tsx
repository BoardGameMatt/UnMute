"use client";

import { useState } from "react";
import { WaoPlayTimer } from "@/lib/protocols/wrong-answers-only/components/WaoPlayTimer";
import type { TruthIsClientAction, TruthIsPlayState } from "../types";
import { BluffRulesBanner } from "./BluffRulesBanner";

type VotingViewProps = {
  state: TruthIsPlayState;
  pending: boolean;
  send: (action: TruthIsClientAction) => Promise<boolean>;
};

export const VotingView = ({ state, pending, send }: VotingViewProps) => {
  const [selected, setSelected] = useState<string | null>(state.myGuessId);
  const confirmed = Boolean(state.myGuessId) || pending;

  let submitClass =
    "mt-8 w-full rounded-md px-5 py-4 font-display text-base font-semibold transition-colors duration-200";
  if (state.myGuessId) {
    submitClass += " bg-signal-amber text-deep-navy";
  } else if (selected) {
    submitClass += " bg-steel-blue text-warm-white hover:bg-unmute-navy";
  } else {
    submitClass += " cursor-not-allowed bg-cloud-grey text-slate opacity-40";
  }

  return (
    <div className="flex min-h-[70vh] flex-col px-5 pb-10 pt-6">
      <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
        WHO WROTE IT?
      </p>
      {state.youAreAuthor ? (
        <div className="mt-6">
          <BluffRulesBanner />
        </div>
      ) : null}
      <p className="mt-4 text-center font-display text-lg font-semibold text-charcoal">
        Who do you think said this?
      </p>
      {state.instruction ? (
        <p className="mt-2 text-center font-body text-sm text-charcoal">{state.instruction}</p>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {state.participants.map((person) => {
          const isSel = (state.myGuessId ?? selected) === person.id;
          return (
            <button
              key={person.id}
              type="button"
              disabled={confirmed}
              onClick={() => setSelected(person.id)}
              className={`rounded-md border bg-warm-white px-4 py-4 text-left font-body text-base text-charcoal shadow-sm transition-colors ${
                isSel
                  ? "border-2 border-unmute-navy font-semibold"
                  : "border-cloud-grey font-medium hover:border-unmute-navy"
              } ${confirmed ? "opacity-80" : ""}`}
            >
              {person.displayName}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={!selected || confirmed}
        onClick={() => {
          if (!selected) return;
          void send({ type: "submitVote", guessedAuthorId: selected });
        }}
        className={submitClass}
      >
        {state.myGuessId ? "Submitted" : "Submit guess"}
      </button>

      <div className="mt-10 flex justify-center">
        <WaoPlayTimer
          durationSeconds={state.timerDurationSeconds || 60}
          startedAt={state.timerStartedAt}
          onComplete={() => void send({ type: "timerExpired" })}
        />
      </div>
    </div>
  );
};
