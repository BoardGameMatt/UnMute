"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ScoreboardEntry = {
  participantId: string;
  displayName: string;
  totalScore: number;
};

type ScoreboardPayload = {
  concurrenceRate: number | null;
  roundsCompleted: number;
  entries: ScoreboardEntry[];
};

type WaoSessionScoreboardProps = {
  sessionId: string;
};

function formatConcurrence(rate: number | null): string {
  if (rate === null || Number.isNaN(Number(rate))) return "—";
  const n = Number(rate);
  return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)}%`;
}

function initialOf(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed[0]!.toUpperCase() : "?";
}

/**
 * Post-session totals. Continue → NPS, then reflection.
 */
export function WaoSessionScoreboard({ sessionId }: WaoSessionScoreboardProps) {
  const [data, setData] = useState<ScoreboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/wao/session/${sessionId}/scoreboard`, {
        credentials: "same-origin",
      });
      if (cancelled) return;
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(body?.error ?? "Could not load the scoreboard.");
        return;
      }
      setData((await res.json()) as ScoreboardPayload);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <main className="min-h-screen bg-warm-white px-5 py-12">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-8">
        <header className="space-y-2 text-center">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-steel-blue">
            Wrong Answers Only
          </p>
          <h1 className="font-display text-3xl font-bold text-unmute-navy">
            Session scores
          </h1>
          {data ? (
            <p className="font-body text-slate">
              {data.roundsCompleted}{" "}
              {data.roundsCompleted === 1 ? "round" : "rounds"} · Concurrence{" "}
              <span className="font-display font-semibold text-unmute-navy">
                {formatConcurrence(data.concurrenceRate)}
              </span>
            </p>
          ) : null}
        </header>

        {error ? (
          <p className="text-center font-body text-signal-red" role="alert">
            {error}
          </p>
        ) : null}

        {!data && !error ? (
          <p className="text-center font-body text-slate">Loading scores…</p>
        ) : null}

        {data ? (
          <ol className="flex flex-col gap-2.5" aria-label="Participant totals">
            {data.entries.map((entry, index) => (
              <li
                key={entry.participantId}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3.5 ${
                  index === 0
                    ? "border-unmute-navy bg-unmute-navy text-warm-white"
                    : "border-cloud-grey bg-warm-white text-charcoal"
                }`}
              >
                <span
                  className={`font-mono text-sm tabular-nums ${
                    index === 0 ? "text-cloud-grey" : "text-steel-blue"
                  }`}
                >
                  {index + 1}
                </span>
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-xs font-medium ${
                    index === 0
                      ? "bg-warm-white text-unmute-navy"
                      : "bg-unmute-navy text-warm-white"
                  }`}
                  aria-hidden
                >
                  {initialOf(entry.displayName)}
                </span>
                <span
                  className={`min-w-0 flex-1 font-display font-semibold ${
                    index === 0 ? "text-warm-white" : "text-unmute-navy"
                  }`}
                >
                  {entry.displayName}
                </span>
                <span className="font-mono text-base tabular-nums">
                  {entry.totalScore}
                </span>
              </li>
            ))}
            {data.entries.length === 0 ? (
              <li className="py-6 text-center font-body text-slate">
                No scored rounds yet.
              </li>
            ) : null}
          </ol>
        ) : null}

        <Link
          href={`/session/${sessionId}/feedback`}
          className="block w-full rounded-md bg-unmute-navy px-6 py-4 text-center font-display text-lg font-semibold text-warm-white shadow-sm transition hover:bg-deep-navy"
        >
          Continue
        </Link>
      </div>
    </main>
  );
}
