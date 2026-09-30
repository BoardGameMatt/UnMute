"use client";

import { useEffect } from "react";
import type { TruthIsClientAction, TruthIsPlayState } from "../types";
import { msUntilServerDue, useServerClockOffset } from "../use-server-clock";

type LeaderboardViewProps = {
  state: TruthIsPlayState;
  pending: boolean;
  send: (action: TruthIsClientAction) => Promise<boolean>;
};

export const LeaderboardView = ({ state, pending, send }: LeaderboardViewProps) => {
  const clockOffsetMs = useServerClockOffset(state.serverNow);
  useEffect(() => {
    const delay = msUntilServerDue(
      state.timerStartedAt,
      state.timerDurationSeconds,
      clockOffsetMs
    );
    if (delay === null) return;
    const t = window.setTimeout(() => void send({ type: "timerExpired" }), Math.max(0, delay));
    const retry = window.setTimeout(
      () => void send({ type: "timerExpired" }),
      Math.max(0, delay + 2_000)
    );
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(retry);
    };
  }, [clockOffsetMs, send, state.timerDurationSeconds, state.timerStartedAt]);

  return (
    <div className="min-h-[50vh] px-5 py-10">
      <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
        Leaderboard
      </p>
      <ol className="mt-8 space-y-2">
        {state.scores.map((person, index) => {
          const topScore = state.scores[0]?.score ?? 0;
          let place = 1;
          for (let i = 1; i <= index; i += 1) {
            const prev = state.scores[i - 1];
            const row = state.scores[i];
            if (prev && row && row.score < prev.score) place = i + 1;
          }
          return (
            <li
              key={person.id}
              className={`flex items-center justify-between rounded-lg border bg-warm-white px-4 py-3 font-body text-base text-charcoal ${
                person.score === topScore ? "border-2 border-unmute-navy" : "border-cloud-grey"
              }`}
            >
              <span className="text-slate">{place}.</span>
              <span className="flex-1 px-3 font-medium">{person.displayName}</span>
              <span className="font-mono text-sm text-unmute-navy">{person.score}</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-8 text-center font-body text-xs text-slate">Continuing in a moment.</p>
      {state.isLead ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void send({ type: "dismissLeaderboard" })}
          className="mt-6 w-full rounded-md border border-cloud-grey py-3 font-display text-sm font-semibold text-unmute-navy hover:bg-cloud-grey disabled:opacity-40"
        >
          Continue
        </button>
      ) : null}
    </div>
  );
};
