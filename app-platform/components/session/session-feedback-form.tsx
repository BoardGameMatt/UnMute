"use client";

import { useState } from "react";

type SessionFeedbackFormProps = {
  sessionId: string;
};

export const SessionFeedbackForm = ({ sessionId }: SessionFeedbackFormProps) => {
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (rating === null || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/session/${sessionId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          comment: comment.trim() === "" ? null : comment,
        }),
      });
      if (!res.ok) {
        const raw = await res.text();
        let message = `Request failed (${res.status})`;
        try {
          const data = JSON.parse(raw) as { error?: string };
          if (data.error) message = data.error;
        } catch {
          if (raw) message = raw;
        }
        throw new Error(message);
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <p className="text-center font-display text-xl font-semibold text-unmute-navy">
        Thanks for your feedback. See you next week.
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-8">
      <div>
        <p className="font-body text-base text-charcoal">
          How likely would you recommend this activity for helping your team build trust?
        </p>
        <div
          className="mt-4 flex flex-wrap justify-center gap-2"
          role="radiogroup"
          aria-label="Rating from 1 to 10"
        >
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
            const filled = rating !== null && n <= rating;
            return (
              <button
                key={n}
                type="button"
                aria-pressed={rating === n}
                aria-label={`${n} of 10`}
                onClick={() => setRating(n)}
                className={`flex h-11 w-11 items-center justify-center rounded-md border font-mono text-sm font-medium shadow-sm transition-colors ${
                  filled
                    ? "border-signal-amber bg-signal-amber text-deep-navy"
                    : "border-cloud-grey bg-cloud-grey text-slate hover:border-steel-blue"
                }`}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor="feedback-comment" className="font-body text-base text-charcoal">
          Tell us more (optional)
        </label>
        <textarea
          id="feedback-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 500))}
          rows={4}
          maxLength={500}
          className="mt-2 w-full rounded-md border border-cloud-grey bg-warm-white px-3 py-2 font-body text-base text-charcoal shadow-sm outline-none ring-unmute-navy focus:ring-2"
        />
        <p className="mt-1 text-right font-body text-xs text-slate">{comment.length}/500</p>
      </div>

      {error ? (
        <p className="text-center font-body text-sm text-signal-red" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={rating === null || submitting}
        onClick={() => void submit()}
        className="w-full rounded-md bg-signal-amber py-4 font-display text-lg font-semibold text-deep-navy shadow-sm transition hover:bg-sunrise-gold disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Submitting…" : "Submit Feedback"}
      </button>
    </div>
  );
};
