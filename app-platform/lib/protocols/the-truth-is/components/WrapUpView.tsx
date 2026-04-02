"use client";

import type { SessionParticipantRole } from "@/lib/types/database";
import type { TruthIsState } from "../types";

type WrapUpViewProps = {
  state: TruthIsState;
  role: SessionParticipantRole;
  sendAction: (type: string, payload: object) => Promise<void>;
};

export const WrapUpView = ({ state, role, sendAction }: WrapUpViewProps) => {
  const remaining = state.entries.filter((e) => !e.used).length;

  if (role === "lead") {
    return (
      <div className="min-h-[50vh] px-5 py-10">
        <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
          WRAP UP
        </p>
        <h2 className="mt-6 text-center font-display text-xl font-semibold text-unmute-navy">
          Everyone&apos;s had a turn. Keep going?
        </h2>
        <p className="mt-3 text-center font-body text-sm text-slate">
          {remaining > 0
            ? `${remaining} entr${remaining === 1 ? "y" : "ies"} still in the pool.`
            : "No entries left in the pool."}
        </p>
        <div className="mt-10 flex flex-col gap-3">
          <button
            type="button"
            disabled={remaining === 0}
            onClick={() => void sendAction("leaderFewMore", {})}
            className="w-full rounded-md border border-cloud-grey bg-warm-white py-4 font-display text-base font-semibold text-unmute-navy transition-colors hover:bg-cloud-grey disabled:cursor-not-allowed disabled:opacity-40"
          >
            A few more
          </button>
          <button
            type="button"
            onClick={() => void sendAction("wrapUp", {})}
            className="w-full rounded-md bg-unmute-navy py-4 font-display text-base font-semibold text-warm-white transition-colors hover:bg-deep-navy"
          >
            Wrap up
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center px-6 text-center">
      <p className="font-body text-base text-slate">
        Waiting for the lead to choose whether to continue or wrap up.
      </p>
    </div>
  );
};
