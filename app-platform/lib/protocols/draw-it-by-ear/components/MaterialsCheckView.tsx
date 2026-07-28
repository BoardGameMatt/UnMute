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
    <div className="mx-auto min-h-[70vh] max-w-md px-5 py-12">
      <div className="space-y-5 text-center font-body text-base text-charcoal">
        <p>
          One teammate sees a whimsical picture — everyone else sketches from their
          description. You&apos;ll have 90 seconds to draw on paper. When the timer
          ends, you&apos;ll score how well the room did.
        </p>
        <p>
          We&apos;ll start with a short practice round. Each round, one person is
          chosen at random to describe the picture — for practice, that&apos;s one
          random person from the room.
        </p>
      </div>

      <h1 className="mt-14 text-center font-display text-2xl font-bold text-unmute-navy">
        What you&apos;ll need
      </h1>

      <ul className="mt-6 space-y-2 font-body text-base text-charcoal">
        <li>Several sheets of blank paper</li>
        <li>A dark, thick marker (Sharpie is ideal)</li>
      </ul>
      <p className="mt-5 font-body text-base text-slate">
        You&apos;ll be drawing on paper — not on your screen.
      </p>

      {role === "lead" ? (
        <div className="mt-14 rounded-lg border border-cloud-grey bg-warm-white p-6 shadow-sm">
          <p className="text-center font-display text-lg font-semibold text-unmute-navy">
            Start the session
          </p>
          <p className="mt-3 text-center font-body text-base text-charcoal">
            Once everyone has pens and paper, choose Short or Full and click Ready.
            You&apos;re the only one who can start — this launches the session for
            the whole team.
          </p>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => setLength("SHORT")}
              className={`flex-1 rounded-md border-2 px-4 py-4 font-display text-sm font-semibold transition-colors ${
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
              className={`flex-1 rounded-md border-2 px-4 py-4 font-display text-sm font-semibold transition-colors ${
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
            className="mt-6 w-full rounded-md bg-signal-amber px-5 py-4 font-display text-base font-semibold text-deep-navy transition-colors hover:bg-sunrise-gold disabled:cursor-not-allowed disabled:opacity-40"
          >
            Ready
          </button>
        </div>
      ) : (
        <p className="mt-14 text-center font-body text-base text-slate">
          Waiting for the lead to start
        </p>
      )}
    </div>
  );
};
