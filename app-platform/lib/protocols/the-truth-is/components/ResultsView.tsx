"use client";

import { useRouter } from "next/navigation";
import type { TruthIsClientAction, TruthIsPlayState } from "../types";

type ResultsViewProps = {
  sessionId: string;
  state: TruthIsPlayState;
  pending: boolean;
  send: (action: TruthIsClientAction) => Promise<boolean>;
};

export const ResultsView = ({ sessionId, state, pending, send }: ResultsViewProps) => {
  const router = useRouter();

  return (
    <div className="min-h-[70vh] px-5 pb-12 pt-8">
      <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
        Results
      </p>
      <h2 className="mt-4 text-center font-display text-2xl font-bold text-unmute-navy">
        Final standings
      </h2>
      <p className="mt-2 text-center font-body text-sm text-slate">
        Total rounds played: {state.totalRoundsPlayed}
      </p>

      <ol className="mt-10 space-y-3">
        {state.scores.map((person, index) => {
          const topScore = state.scores[0]?.score ?? 0;
          let place = 1;
          for (let i = 1; i <= index; i += 1) {
            const prev = state.scores[i - 1];
            const row = state.scores[i];
            if (prev && row && row.score < prev.score) place = i + 1;
          }
          return (
            <li
              key={person.id}
              className={`flex items-center justify-between rounded-lg border bg-warm-white px-4 py-3 font-body text-base text-charcoal ${
                person.score === topScore ? "border-2 border-unmute-navy" : "border-cloud-grey"
              }`}
            >
              <span className="text-slate">{place}.</span>
              <span className="flex-1 px-3 font-medium">{person.displayName}</span>
              <span className="font-mono text-sm text-unmute-navy">{person.score}</span>
            </li>
          );
        })}
      </ol>

      {state.mostSurprising ? (
        <div className="mt-10 rounded-lg border border-cloud-grey bg-warm-white p-5 shadow-sm">
          <p className="font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
            Most surprising
          </p>
          <p className="mt-3 font-body text-sm text-charcoal">“{state.mostSurprising.text}”</p>
          <p className="mt-2 font-body text-xs text-slate">— {state.mostSurprising.authorName}</p>
        </div>
      ) : null}

      {state.isLead ? (
        <>
          <p className="mt-10 text-center font-mono text-[10px] uppercase tracking-widest text-steel-blue">
            Facilitator
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              void send({ type: "advanceRecap" }).then((ok) => {
                if (ok) router.replace(`/session/${sessionId}/feedback`);
              });
            }}
            className="mt-4 w-full rounded-md bg-signal-amber py-4 font-display text-base font-semibold text-deep-navy transition-colors hover:bg-sunrise-gold disabled:opacity-40"
          >
            Continue to debrief
          </button>
        </>
      ) : (
        <p className="mt-12 text-center font-body text-slate">
          Waiting for the facilitator to continue.
        </p>
      )}
    </div>
  );
};
