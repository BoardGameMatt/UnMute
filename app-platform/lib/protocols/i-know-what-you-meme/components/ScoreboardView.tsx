"use client";

import { computeScoreboard } from "../engine";
import type { IKWYMState } from "../types";

type ScoreboardViewProps = {
  state: IKWYMState;
  sendAction: (type: string, payload: object) => Promise<void>;
};

export const ScoreboardView = ({ state, sendAction }: ScoreboardViewProps) => {
  const ranked = computeScoreboard(state);
  const topId = ranked[0]?.participantId;

  return (
    <div className="min-h-[70vh] px-5 py-10">
      <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
        FINAL SCORES
      </p>
      <h1 className="mt-4 text-center font-display text-3xl font-bold text-unmute-navy">
        Scoreboard
      </h1>

      <ol className="mx-auto mt-8 max-w-md space-y-0 overflow-hidden rounded-lg border border-cloud-grey shadow-sm">
        {ranked.map((row, i) => (
          <li
            key={row.participantId}
            className={`flex items-center justify-between border-b border-cloud-grey px-4 py-3 font-body text-base last:border-b-0 ${
              row.participantId === topId
                ? "border-l-4 border-l-unmute-navy bg-unmute-navy text-warm-white"
                : i % 2 === 0
                  ? "bg-warm-white text-charcoal"
                  : "bg-cloud-grey/30 text-charcoal"
            }`}
          >
            <span className={row.participantId === topId ? "text-warm-white/80" : "text-slate"}>
              {i + 1}.
            </span>
            <span className="flex-1 px-3 font-medium">{row.displayName}</span>
            <span className="font-mono text-sm">{row.score}</span>
          </li>
        ))}
      </ol>

      <div className="mx-auto mt-10 flex max-w-md gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex-1 rounded-md border border-cloud-grey py-3 font-display text-sm font-semibold text-unmute-navy hover:bg-cloud-grey"
        >
          Replay
        </button>
        <button
          type="button"
          onClick={() => void sendAction("endSession", {})}
          className="flex-1 rounded-md bg-signal-amber py-3 font-display text-sm font-semibold text-deep-navy hover:bg-sunrise-gold"
        >
          Debrief
        </button>
      </div>
    </div>
  );
};
