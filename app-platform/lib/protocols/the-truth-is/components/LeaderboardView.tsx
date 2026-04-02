"use client";

import { useCallback, useEffect } from "react";
import type { SessionParticipantRole } from "@/lib/types/database";
import type { TruthIsState } from "../types";

type LeaderboardViewProps = {
  state: TruthIsState;
  role: SessionParticipantRole;
  sendAction: (type: string, payload: object) => Promise<void>;
};

export const LeaderboardView = ({ state, role, sendAction }: LeaderboardViewProps) => {
  const onTimer = useCallback(() => {
    void sendAction("leaderboardTimerExpired", {});
  }, [sendAction]);

  useEffect(() => {
    const t = window.setTimeout(onTimer, 5000);
    return () => clearTimeout(t);
  }, [onTimer]);

  const ranked = [...state.participants]
    .map((p) => ({ ...p, score: state.scores[p.id] ?? 0 }))
    .sort((a, b) => b.score - a.score);

  const topId = ranked[0]?.id;

  return (
    <div className="min-h-[50vh] px-5 py-10">
      <p className="text-center font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-steel-blue">
        UNMUTE
      </p>
      <p className="mt-2 text-center font-mono text-xs font-normal uppercase tracking-widest text-signal-amber">
        The Truth Is…
      </p>
      <p className="mt-6 text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
        LEADERBOARD
      </p>
      <ol className="mt-8 space-y-0 overflow-hidden rounded-lg border border-cloud-grey shadow-sm">
        {ranked.map((p, i) => (
          <li
            key={p.id}
            className={`flex items-center justify-between border-b border-cloud-grey px-4 py-3 font-body text-base last:border-b-0 ${
              p.id === topId
                ? "border-l-4 border-l-signal-amber bg-warm-white text-charcoal"
                : i % 2 === 0
                  ? "bg-warm-white text-charcoal"
                  : "bg-unmute-navy/[0.06] text-charcoal"
            }`}
          >
            <span className="text-slate">{i + 1}.</span>
            <span className="flex-1 px-3 font-medium">{p.display_name}</span>
            <span className="font-mono text-sm">{p.score}</span>
          </li>
        ))}
      </ol>
      <p className="mt-8 text-center font-body text-xs text-slate">
        Auto-continuing in a few seconds…
      </p>
      {role === "lead" ? (
        <button
          type="button"
          onClick={() => void sendAction("dismissLeaderboard", {})}
          className="mt-6 w-full rounded-md border border-cloud-grey py-3 font-display text-sm font-semibold text-unmute-navy hover:bg-cloud-grey"
        >
          Continue
        </button>
      ) : null}
    </div>
  );
};
