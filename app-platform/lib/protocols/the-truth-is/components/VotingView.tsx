"use client";

import { useCallback, useMemo, useState } from "react";
import { TimerArc } from "@/components/ui/TimerArc";
import type { TruthIsState } from "../types";

type VotingViewProps = {
  state: TruthIsState;
  participantId: string;
  sendAction: (type: string, payload: object) => Promise<void>;
};

export const VotingView = ({ state, participantId, sendAction }: VotingViewProps) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const guessOptions = useMemo(() => state.participants, [state.participants]);

  const handleConfirm = useCallback(async () => {
    if (!selected || confirmed) return;
    setConfirmed(true);
    await sendAction("submitVote", {
      voterId: participantId,
      guessedAuthorId: selected,
    });
  }, [selected, confirmed, sendAction, participantId]);

  const handleTimerComplete = useCallback(async () => {
    await sendAction("votingTimerExpired", {});
  }, [sendAction]);

  let submitClass =
    "mt-8 w-full rounded-md px-5 py-4 font-display text-base font-semibold transition-colors duration-200";
  if (confirmed) {
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
      <p className="mt-4 text-center font-display text-lg font-semibold text-charcoal">
        Who do you think said this?
      </p>
      <p className="mt-2 text-center font-body text-sm text-slate">
        Tap a card, then submit your guess.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {guessOptions.map((p) => {
          const isSel = selected === p.id;
          return (
            <button
              key={p.id}
              type="button"
              disabled={confirmed}
              onClick={() => !confirmed && setSelected(p.id)}
              className={`rounded-md border px-4 py-4 text-left font-body text-base font-medium shadow-sm transition-colors active:scale-[0.99] ${
                isSel
                  ? "border-unmute-navy bg-cloud-grey/50 text-deep-navy"
                  : "border-cloud-grey bg-warm-white text-charcoal hover:border-unmute-navy hover:shadow-md"
              } ${confirmed ? "opacity-80" : ""}`}
            >
              {p.display_name}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={!selected || confirmed}
        onClick={() => void handleConfirm()}
        className={submitClass}
      >
        {confirmed ? "Guess sent" : "Submit Guess"}
      </button>

      <div className="mt-10 flex justify-center">
        <TimerArc
          durationSeconds={state.timer_duration_seconds || 15}
          startedAt={state.timer_started_at}
          onComplete={handleTimerComplete}
          size={120}
        />
      </div>
    </div>
  );
};
