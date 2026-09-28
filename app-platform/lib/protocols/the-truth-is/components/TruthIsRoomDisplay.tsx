"use client";

import type { TruthIsPlayState } from "../types";

type Props = {
  state: TruthIsPlayState;
};

/** Public board for the pinned laptop. No text field, no votes, no bluff banner. */
export function TruthIsRoomDisplay({ state }: Props) {
  const writing = state.phase === "SUBMISSION_1" || state.phase === "SUBMISSION_2";

  return (
    <div className="flex min-h-[70vh] flex-col items-center px-5 pb-10 pt-8 text-center">
      <p className="font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
        {writing ? "THE TRUTH IS..." : "WHO WROTE IT?"}
      </p>
      {writing ? (
        <>
          <h1 className="mt-6 font-display text-3xl font-bold text-unmute-navy">
            Everyone is writing on their phone.
          </h1>
          <p className="mt-4 max-w-md font-body text-base text-charcoal">
            This screen stays shared.
          </p>
        </>
      ) : (
        <>
          {state.currentEntryText ? (
            <p className="mx-auto mt-8 max-w-3xl font-display text-4xl font-bold leading-tight text-unmute-navy">
              {state.currentEntryText}
            </p>
          ) : null}
          <p className="mt-6 font-body text-lg text-charcoal">Guess on your phone.</p>
        </>
      )}
    </div>
  );
}
