"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { TimerArc } from "@/components/ui/TimerArc";
import type { TruthIsState } from "../types";

const MAX_LEN = 300;

type SubmissionViewProps = {
  round: 1 | 2;
  state: TruthIsState;
  participantId: string;
  sendAction: (type: string, payload: object) => Promise<void>;
};

export const SubmissionView = ({
  round,
  state,
  participantId,
  sendAction,
}: SubmissionViewProps) => {
  const [text, setText] = useState("");
  const textRef = useRef(text);
  textRef.current = text;
  const [submitted, setSubmitted] = useState(false);
  const [timerDone, setTimerDone] = useState(false);

  const doneForRound = useMemo(() => {
    const hasEntry = state.entries.some(
      (e) => e.author_id === participantId && e.round_submitted === round
    );
    const skip = state.skipped_rounds[participantId];
    const skipped = round === 1 ? skip?.r1 : skip?.r2;
    return hasEntry || skipped === true;
  }, [state.entries, state.skipped_rounds, participantId, round]);

  const handleSubmit = useCallback(async () => {
    if (doneForRound || submitted) return;
    setSubmitted(true);
    await sendAction("submitEntry", {
      participantId,
      text: text.trim(),
      round,
    });
  }, [doneForRound, submitted, sendAction, participantId, text, round]);

  const handleTimerComplete = useCallback(async () => {
    setTimerDone(true);
    await sendAction("submitEntry", {
      participantId,
      text: textRef.current.trim(),
      round,
    });
    await sendAction("submissionTimerExpired", { round });
  }, [sendAction, round, participantId]);

  const canType = !doneForRound && !submitted && !timerDone;
  const hasText = text.trim().length > 0;

  let buttonClass =
    "w-full rounded-md px-5 py-4 font-display text-base font-semibold transition-colors duration-200";
  if (submitted || doneForRound) {
    buttonClass += " bg-signal-amber text-deep-navy";
  } else if (hasText) {
    buttonClass += " bg-unmute-navy text-warm-white hover:bg-deep-navy";
  } else {
    buttonClass += " cursor-not-allowed bg-cloud-grey text-slate opacity-40";
  }

  return (
    <div className="flex min-h-[70vh] flex-col px-5 pb-10 pt-6">
      <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
        THE TRUTH IS...
      </p>
      <h1 className="mt-6 text-center font-display text-3xl font-bold text-unmute-navy">
        The truth is...
      </h1>

      <div className="mt-8 rounded-lg border border-cloud-grey bg-warm-white p-6 shadow-sm">
        <label htmlFor="truth-input" className="sr-only">
          Your truth
        </label>
        <p className="font-body text-sm leading-relaxed text-slate">
          {round === 1 ? (
            "...here's something about me that might surprise some people."
          ) : (
            <>
              ...something even <span className="font-bold text-charcoal">MORE</span>{" "}
              surprising.
            </>
          )}
        </p>
        <textarea
          id="truth-input"
          maxLength={MAX_LEN}
          disabled={!canType}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
          rows={5}
          className="mt-4 w-full resize-none rounded-md border border-cloud-grey bg-warm-white px-4 py-3 font-body text-base text-charcoal outline-none ring-unmute-navy focus:ring-2 disabled:opacity-50"
          placeholder=""
        />
        <p className="mt-2 text-right font-body text-xs text-slate">
          {text.length}/{MAX_LEN}
        </p>
      </div>

      <div className="mt-10 flex flex-col items-center gap-6">
        <TimerArc
          durationSeconds={state.timer_duration_seconds || 42}
          startedAt={state.timer_started_at}
          onComplete={handleTimerComplete}
        />
        <button
          type="button"
          disabled={!hasText || !canType}
          onClick={() => void handleSubmit()}
          className={buttonClass}
        >
          {submitted || doneForRound ? "Submitted" : "Submit"}
        </button>
        {(submitted || doneForRound) && (
          <p className="font-body text-sm text-slate">Got it.</p>
        )}
      </div>
    </div>
  );
};
