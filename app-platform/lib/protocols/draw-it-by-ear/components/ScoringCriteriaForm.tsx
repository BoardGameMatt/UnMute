"use client";

import { useCallback, useMemo, useState } from "react";
import { TimerArc } from "@/components/ui/TimerArc";
import { useDibeImage } from "../hooks/useDibeImage";
import type { DibeCriterion } from "../types";

type ScoringCriteriaFormProps = {
  sessionId: string;
  criteria: DibeCriterion[];
  timerStartedAt: string | null;
  timerDurationSeconds: number;
  participantId: string;
  imageName: string | null;
  existingAnswers: Record<string, boolean> | undefined;
  tierLabel?: string;
  sendAction: (type: string, payload: object) => Promise<void>;
};

export const ScoringCriteriaForm = ({
  sessionId,
  criteria,
  timerStartedAt,
  timerDurationSeconds,
  participantId,
  imageName,
  existingAnswers,
  tierLabel,
  sendAction,
}: ScoringCriteriaFormProps) => {
  const { signedUrl, loading, error } = useDibeImage(sessionId, participantId, true);
  const [answers, setAnswers] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const c of criteria) {
      if (typeof existingAnswers?.[c.text] === "boolean") {
        initial[c.text] = existingAnswers[c.text];
      }
    }
    return initial;
  });
  const [submitted, setSubmitted] = useState(false);

  const allAnswered = useMemo(
    () => criteria.every((c) => typeof answers[c.text] === "boolean"),
    [criteria, answers]
  );

  const handleToggle = (text: string, value: boolean) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [text]: value }));
  };

  const handleSubmit = useCallback(async () => {
    if (!allAnswered || submitted) return;
    setSubmitted(true);
    await sendAction("submitScoring", { participantId, answers });
  }, [allAnswered, submitted, sendAction, participantId, answers]);

  const handleTimerComplete = useCallback(async () => {
    if (!submitted) {
      setSubmitted(true);
      await sendAction("submitScoring", { participantId, answers });
    }
    await sendAction("scoringTimerExpired", {});
  }, [submitted, sendAction, participantId, answers]);

  let buttonClass =
    "mt-8 w-full rounded-md px-5 py-4 font-display text-base font-semibold transition-colors duration-200";
  if (submitted) {
    buttonClass += " bg-signal-amber text-deep-navy";
  } else if (allAnswered) {
    buttonClass += " bg-unmute-navy text-warm-white hover:bg-deep-navy";
  } else {
    buttonClass += " cursor-not-allowed bg-cloud-grey text-slate opacity-40";
  }

  return (
    <div className="flex min-h-[70vh] flex-col px-5 pb-10 pt-6">
      <div className="mx-auto w-full max-w-md">
        <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
          SCORE YOUR DRAWING
        </p>
        {tierLabel ? (
          <p className="mt-2 text-center font-mono text-xs uppercase tracking-widest text-signal-amber">
            {tierLabel}
          </p>
        ) : null}
        <p className="mt-4 text-center font-body text-sm text-slate">
          How well did you do?
        </p>

        {loading ? (
          <p className="mt-6 text-center font-body text-sm text-slate">Loading reference…</p>
        ) : error ? null : signedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={signedUrl}
            alt={imageName ?? "Reference image"}
            className="mx-auto mt-6 max-h-32 w-full object-contain"
          />
        ) : null}

        <div className="mt-6 flex justify-center">
          <TimerArc
            durationSeconds={timerDurationSeconds}
            startedAt={timerStartedAt}
            onComplete={() => void handleTimerComplete()}
            size={120}
          />
        </div>

        <ul className="mt-8 space-y-3">
          {criteria.map((c) => {
            const val = answers[c.text];
            return (
              <li
                key={c.text}
                className="rounded-lg border border-cloud-grey bg-warm-white p-4 shadow-sm"
              >
                <p className="font-body text-sm text-charcoal">{c.text}</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-slate">
                  ({c.points} pt{c.points > 1 ? "s" : ""})
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={submitted}
                    onClick={() => handleToggle(c.text, true)}
                    className={`flex-1 rounded-md border py-2 font-display text-sm font-semibold transition-colors ${
                      val === true
                        ? "border-signal-amber bg-signal-amber text-deep-navy"
                        : "border-cloud-grey text-unmute-navy hover:bg-cloud-grey"
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    disabled={submitted}
                    onClick={() => handleToggle(c.text, false)}
                    className={`flex-1 rounded-md border py-2 font-display text-sm font-semibold transition-colors ${
                      val === false
                        ? "border-unmute-navy bg-unmute-navy text-warm-white"
                        : "border-cloud-grey text-unmute-navy hover:bg-cloud-grey"
                    }`}
                  >
                    No
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          disabled={!allAnswered || submitted}
          onClick={() => void handleSubmit()}
          className={buttonClass}
        >
          {submitted ? "Submitted" : "Submit"}
        </button>
      </div>
    </div>
  );
};
