"use client";

import type { SessionParticipantRole } from "@/lib/types/database";
import type { DibeSessionLength, DibeState } from "../types";

type MaterialsCheckViewProps = {
  state: DibeState;
  role: SessionParticipantRole;
  sendAction: (type: string, payload: object) => Promise<void>;
};

export const MaterialsCheckView = ({
  state,
  role,
  sendAction,
}: MaterialsCheckViewProps) => {
  const setLength = (sessionLength: DibeSessionLength) => {
    void sendAction("setSessionLength", { sessionLength });
  };

  return (
    <div className="min-h-[70vh] px-5 py-10">
      <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
        DRAW IT BY EAR
      </p>
      <h1 className="mt-6 text-center font-display text-3xl font-bold text-unmute-navy">
        Grab your supplies
      </h1>
      <ul className="mx-auto mt-8 max-w-sm space-y-3 font-body text-base text-charcoal">
        <li className="rounded-lg border border-cloud-grey bg-warm-white px-5 py-4 shadow-sm">
          Several sheets of blank paper
        </li>
        <li className="rounded-lg border border-cloud-grey bg-warm-white px-5 py-4 shadow-sm">
          A dark, thick marker (Sharpie is ideal)
        </li>
      </ul>
      <p className="mt-6 text-center font-mono text-xs text-slate">
        You&apos;ll be drawing on paper — not on your screen.
      </p>

      {role === "lead" ? (
        <div className="mx-auto mt-10 max-w-sm space-y-4">
          <p className="text-center font-mono text-[10px] uppercase tracking-widest text-steel-blue">
            Session length
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setLength("SHORT")}
              className={`flex-1 rounded-md border px-4 py-3 font-display text-sm font-semibold transition-colors ${
                state.session_length === "SHORT"
                  ? "border-signal-amber bg-signal-amber text-deep-navy"
                  : "border-cloud-grey text-unmute-navy hover:bg-cloud-grey"
              }`}
            >
              Short (3 rounds)
            </button>
            <button
              type="button"
              onClick={() => setLength("FULL")}
              className={`flex-1 rounded-md border px-4 py-3 font-display text-sm font-semibold transition-colors ${
                state.session_length === "FULL"
                  ? "border-signal-amber bg-signal-amber text-deep-navy"
                  : "border-cloud-grey text-unmute-navy hover:bg-cloud-grey"
              }`}
            >
              Full (5 rounds)
            </button>
          </div>
          <button
            type="button"
            disabled={!state.session_length}
            onClick={() => void sendAction("readyMaterials", {})}
            className="w-full rounded-md bg-signal-amber px-5 py-4 font-display text-base font-semibold text-deep-navy transition-colors hover:bg-sunrise-gold disabled:cursor-not-allowed disabled:opacity-40"
          >
            Ready
          </button>
        </div>
      ) : null}
    </div>
  );
};
