"use client";

import { useCallback, useRef, useState } from "react";
import { WaoPlayTimer } from "@/lib/protocols/wrong-answers-only/components/WaoPlayTimer";
import type { TruthIsClientAction, TruthIsPlayState } from "../types";

const MAX_LEN = 300;

type SubmissionViewProps = {
  state: TruthIsPlayState;
  pending: boolean;
  send: (action: TruthIsClientAction) => Promise<boolean>;
};

export const SubmissionView = ({ state, pending, send }: SubmissionViewProps) => {
  const round = state.submissionRound ?? 1;
  const [text, setText] = useState(state.mySubmittedText ?? "");
  const textRef = useRef(text);
  textRef.current = text;
  const [submitted, setSubmitted] = useState(state.mySubmissionDone);
  const locked = submitted || state.mySubmissionDone || pending;

  const handleSubmit = useCallback(async () => {
    if (locked) return;
    const draft = textRef.current.trim();
    if (!draft) return;
    setSubmitted(true);
    const ok = await send({ type: "submitEntry", text: draft, round });
    if (!ok) setSubmitted(false);
  }, [locked, round, send]);

  const handleTimerComplete = useCallback(() => {
    if (state.mySubmissionDone) {
      void send({ type: "timerExpired" });
      return;
    }
    setSubmitted(true);
    void send({ type: "submitOnTimeout", text: textRef.current, round });
  }, [round, send, state.mySubmissionDone]);

  const hasText = text.trim().length > 0;
  let buttonClass =
    "w-full rounded-md px-5 py-4 font-display text-base font-semibold transition-colors duration-200";
  if (submitted || state.mySubmissionDone) {
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
              ...something even <span className="font-bold text-charcoal">MORE</span> surprising.
            </>
          )}
        </p>
        <textarea
          id="truth-input"
          maxLength={MAX_LEN}
          disabled={locked}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
          rows={5}
          className="mt-4 w-full resize-none rounded-md border border-cloud-grey bg-warm-white px-4 py-3 font-body text-base text-charcoal outline-none ring-unmute-navy focus:ring-2 disabled:opacity-50"
        />
        <p className="mt-2 text-right font-body text-xs text-slate">
          {text.length}/{MAX_LEN}
        </p>
      </div>

      <div className="mt-10 flex flex-col items-center gap-6">
        <WaoPlayTimer
          durationSeconds={state.timerDurationSeconds || 42}
          startedAt={state.timerStartedAt}
          onComplete={handleTimerComplete}
        />
        <button
          type="button"
          disabled={!hasText || locked}
          onClick={() => void handleSubmit()}
          className={buttonClass}
        >
          {submitted || state.mySubmissionDone ? "Submitted" : "Submit"}
        </button>
        {(submitted || state.mySubmissionDone) && (
          <p className="font-body text-sm text-slate">Got it.</p>
        )}
      </div>
    </div>
  );
};
