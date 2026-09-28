"use client";

import type { TruthIsClientAction, TruthIsPlayState } from "../types";

type WrapUpViewProps = {
  state: TruthIsPlayState;
  pending: boolean;
  send: (action: TruthIsClientAction) => Promise<boolean>;
};

export const WrapUpView = ({ state, pending, send }: WrapUpViewProps) => {
  if (!state.isLead) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center px-6 text-center">
        <p className="font-body text-base text-slate">
          Waiting for the facilitator to continue.
        </p>
      </div>
    );
  }

  const remaining = state.entriesRemaining;

  return (
    <div className="min-h-[50vh] px-5 py-10">
      <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
        Facilitator
      </p>
      <h2 className="mt-6 text-center font-display text-xl font-semibold text-unmute-navy">
        Everyone&apos;s had a turn. Keep going?
      </h2>
      <p className="mt-3 text-center font-body text-sm text-slate">
        {remaining > 0
          ? `${remaining} ${remaining === 1 ? "entry" : "entries"} still in the pool.`
          : "No entries left in the pool."}
      </p>
      <div className="mt-10 flex flex-col gap-3">
        <button
          type="button"
          disabled={pending || remaining === 0}
          onClick={() => void send({ type: "leaderFewMore" })}
          className="w-full rounded-md border border-cloud-grey bg-warm-white py-4 font-display text-base font-semibold text-unmute-navy transition-colors hover:bg-cloud-grey disabled:cursor-not-allowed disabled:opacity-40"
        >
          A few more
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => void send({ type: "wrapUp" })}
          className="w-full rounded-md bg-signal-amber py-4 font-display text-base font-semibold text-deep-navy transition-colors hover:bg-sunrise-gold disabled:opacity-40"
        >
          Wrap up
        </button>
      </div>
    </div>
  );
};
