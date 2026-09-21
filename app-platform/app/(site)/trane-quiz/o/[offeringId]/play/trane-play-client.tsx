"use client";

import { useCallback, useEffect, useState } from "react";

type Option = { key: string; label: string };
type Question = {
  id: string;
  sortOrder: number;
  stem: string;
  options: Option[];
};

type MissedQuestion = {
  sortOrder: number;
  stem: string;
  selectedLabel: string;
  correctLabel: string;
};

type PostResults = {
  postPercent: number;
  postCorrect: number;
  total: number;
  paired: boolean;
  prePercent: number | null;
  deltaPp: number | null;
  missed: MissedQuestion[];
};

type PlayState = {
  offeringPhase: string;
  activePhase: "pre" | "post" | null;
  courseTitle: string;
  classDate: string;
  preCompleted: boolean;
  postCompleted: boolean;
  needsUnpairedConfirm: boolean;
  phaseDone: boolean;
  answeredCount: number;
  currentQuestionIndex: number;
  questions: Question[];
  results: PostResults | null;
};

const fmtPct = (n: number): string =>
  `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)}%`;

const fmtDelta = (n: number): string => {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)} pp`;
};

type TranePlayClientProps = {
  offeringId: string;
};

const backupKey = (offeringId: string) =>
  `trane_quiz_participant:${offeringId}`;

export function TranePlayClient({ offeringId }: TranePlayClientProps) {
  const [state, setState] = useState<PlayState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dismissedUnpaired, setDismissedUnpaired] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/trane-quiz/o/${offeringId}/state`, {
      cache: "no-store",
    });
    if (res.status === 401) {
      setError("Not joined — scan the QR again.");
      return;
    }
    if (!res.ok) {
      setError("Could not load quiz.");
      return;
    }
    const data = (await res.json()) as PlayState;
    setState(data);
    setSelected(null);
    try {
      window.localStorage.setItem(backupKey(offeringId), "1");
    } catch {
      // ignore quota / private mode
    }
  }, [offeringId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep polling until POST is done or the session is closed
  useEffect(() => {
    if (!state) return;
    if (state.postCompleted || state.offeringPhase === "closed") return;
    // Actively answering — still poll occasionally so phase changes land
    const ms =
      state.activePhase && !state.phaseDone && !state.needsUnpairedConfirm
        ? 5000
        : 2500;
    const id = window.setInterval(() => void load(), ms);
    return () => window.clearInterval(id);
  }, [state, load]);

  const confirmUnpaired = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/trane-quiz/o/${offeringId}/confirm-unpaired`,
        { method: "POST" }
      );
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Could not confirm");
        return;
      }
      setDismissedUnpaired(false);
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const submitAnswer = async () => {
    if (!state || selected === null) return;
    const q = state.questions[state.currentQuestionIndex];
    if (!q) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/trane-quiz/o/${offeringId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: q.id,
          selectedOption: selected,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not submit");
        return;
      }
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  if (error && !state) {
    return (
      <main className="mx-auto max-w-lg px-5 py-16 text-center">
        <p className="text-trane-alert">{error}</p>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="mx-auto max-w-lg px-5 py-16 text-center text-trane-gray">
        Loading…
      </main>
    );
  }

  // Finished end quiz — show score even if the facilitator has closed
  if (state.postCompleted) {
    const results = state.results;
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-5 py-12">
        <header className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-trane-deep">
            End-of-class knowledge check
          </p>
          <h1 className="text-2xl text-trane-purple">You’re done</h1>
          <p className="text-base text-[#111]">
            Return to the training room. Thank you.
          </p>
        </header>

        {results ? (
          <>
            <section className="rounded-lg border border-[#EEE] bg-[#F7F4FF] p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-trane-deep">
                Your score
              </p>
              <p className="mt-2 text-4xl font-bold text-trane-purple">
                {fmtPct(results.postPercent)}
              </p>
              <p className="mt-1 text-sm text-trane-gray">
                {results.postCorrect} of {results.total} correct
              </p>
              {results.paired &&
              results.prePercent !== null &&
              results.deltaPp !== null ? (
                <p className="mt-4 text-base text-[#111]">
                  Beginning {fmtPct(results.prePercent)} → End{" "}
                  {fmtPct(results.postPercent)} ({fmtDelta(results.deltaPp)})
                </p>
              ) : null}
            </section>

            {results.missed.length === 0 ? (
              <p className="text-base text-[#111]">
                You answered every question correctly.
              </p>
            ) : (
              <section className="space-y-3">
                <h2 className="text-lg text-trane-purple">
                  Review the ones you missed
                </h2>
                <ul className="flex flex-col gap-3">
                  {results.missed.map((item) => (
                    <li
                      key={item.sortOrder}
                      className="rounded-lg border border-[#EEE] p-6"
                    >
                      <p className="text-xs font-bold uppercase tracking-widest text-trane-deep">
                        Question {item.sortOrder}
                      </p>
                      <p className="mt-2 text-base leading-snug text-[#111]">
                        {item.stem}
                      </p>
                      <p className="mt-3 text-sm text-trane-gray">
                        Your answer: {item.selectedLabel}
                      </p>
                      <p className="mt-1 text-sm text-[#111]">
                        Correct answer: {item.correctLabel}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : null}
      </main>
    );
  }

  // Closed session
  if (state.offeringPhase === "closed") {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-5 py-16 text-center">
        <h1 className="text-2xl text-trane-purple">
          {state.preCompleted ? "You’re done" : "This quiz is closed"}
        </h1>
        <p className="text-base text-[#111]">
          Return to the training room. Thank you.
        </p>
      </main>
    );
  }

  // Finished beginning; waiting for end quiz to open
  if (state.preCompleted && state.offeringPhase !== "post_open") {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-5 py-16 text-center">
        <h1 className="text-2xl text-trane-purple">Beginning quiz complete</h1>
        <p className="text-base text-[#111]">
          You’re done for now. Keep this page open or come back on this same
          phone for the end-of-class quiz.
        </p>
        <p className="text-sm text-trane-gray">Waiting for the facilitator…</p>
      </main>
    );
  }

  // End quiz open but no PRE — confirmation (unless dismissed)
  if (state.needsUnpairedConfirm && !dismissedUnpaired) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-5 py-12">
        <h1 className="text-2xl text-trane-purple">End-of-class quiz</h1>
        <p className="text-base leading-relaxed text-[#111]">
          You didn’t complete the beginning quiz on this phone. Continue with
          the end-of-class quiz only?
        </p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={submitting}
            onClick={() => void confirmUnpaired()}
            className="rounded-md bg-trane-purple px-5 py-3.5 font-bold text-white disabled:opacity-40"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={() => setDismissedUnpaired(true)}
            className="rounded-md border border-[#DDD] px-5 py-3 text-trane-deep"
          >
            Go back
          </button>
        </div>
        {error ? (
          <p className="text-sm text-trane-alert" role="alert">
            {error}
          </p>
        ) : null}
      </main>
    );
  }

  if (dismissedUnpaired && state.needsUnpairedConfirm) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-5 py-16 text-center">
        <h1 className="text-2xl text-trane-purple">Waiting</h1>
        <p className="text-sm text-trane-gray">
          Use the same phone you used for the beginning quiz, or tap Continue
          below to take the end quiz only.
        </p>
        <button
          type="button"
          onClick={() => setDismissedUnpaired(false)}
          className="rounded-md bg-trane-purple px-5 py-3.5 font-bold text-white"
        >
          Continue with end quiz only
        </button>
      </main>
    );
  }

  // No active answering phase yet
  if (!state.activePhase) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-5 py-16 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-trane-deep">
          {state.courseTitle}
        </p>
        <h1 className="text-2xl text-trane-purple">Waiting to start</h1>
        <p className="text-sm text-trane-gray">
          The facilitator will open the quiz shortly.
        </p>
      </main>
    );
  }

  const q = state.questions[state.currentQuestionIndex];
  if (!q) {
    return (
      <main className="mx-auto max-w-lg px-5 py-16 text-center">
        <p className="text-trane-gray">Loading next question…</p>
      </main>
    );
  }

  const progressLabel = `Question ${q.sortOrder} of ${state.questions.length}`;
  const phaseLabel =
    state.activePhase === "pre" ? "Beginning quiz" : "End-of-class quiz";

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-5 py-8">
      <header className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-widest text-trane-deep">
          {phaseLabel}
        </p>
        <p className="text-sm text-trane-gray">{progressLabel}</p>
        <div className="h-1 w-full overflow-hidden rounded-full bg-[#EEE]">
          <div
            className="h-full bg-trane-purple transition-[width] duration-300"
            style={{
              width: `${(state.answeredCount / state.questions.length) * 100}%`,
            }}
          />
        </div>
      </header>

      <h1 className="text-xl leading-snug text-trane-purple sm:text-2xl">
        {q.stem}
      </h1>

      <ul className="flex flex-col gap-2">
        {q.options.map((opt) => {
          const isSelected = selected === opt.key;
          return (
            <li key={opt.key}>
              <button
                type="button"
                onClick={() => setSelected(opt.key)}
                className={`w-full rounded-lg border px-4 py-3.5 text-left text-base transition-colors ${
                  isSelected
                    ? "border-trane-purple bg-trane-purple text-white"
                    : "border-[#DDD] bg-white text-[#111] hover:border-trane-purple/40"
                }`}
              >
                {opt.label}
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        disabled={!selected || submitting}
        onClick={() => void submitAnswer()}
        className="mt-auto rounded-md bg-trane-deep px-5 py-3.5 text-base font-bold text-white disabled:cursor-not-allowed disabled:bg-[#CCC]"
      >
        {submitting ? "Submitting…" : "Submit"}
      </button>

      {error ? (
        <p className="text-sm text-trane-alert" role="alert">
          {error}
        </p>
      ) : null}
    </main>
  );
}
