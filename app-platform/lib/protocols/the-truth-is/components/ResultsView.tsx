"use client";

import { useMemo } from "react";
import type { TruthIsState } from "../types";
import type { SessionParticipantRole } from "@/lib/types/database";

type ResultsViewProps = {
  state: TruthIsState;
  role: SessionParticipantRole;
  sendAction: (type: string, payload: object) => Promise<void>;
};

export const ResultsView = ({ state, role, sendAction }: ResultsViewProps) => {
  const ranked = useMemo(
    () =>
      [...state.participants]
        .map((p) => ({ ...p, score: state.scores[p.id] ?? 0 }))
        .sort((a, b) => b.score - a.score),
    [state.participants, state.scores]
  );

  const topId = ranked[0]?.id;

  const surprising = useMemo(() => {
    if (!state.most_surprising_entry_id) return null;
    return state.entries.find((e) => e.id === state.most_surprising_entry_id);
  }, [state.entries, state.most_surprising_entry_id]);

  const surprisingAuthor = useMemo(() => {
    if (!surprising) return null;
    return state.participants.find((p) => p.id === surprising.author_id);
  }, [surprising, state.participants]);

  return (
    <div className="min-h-[70vh] px-5 pb-12 pt-8">
      <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
        RESULTS
      </p>
      <h2 className="mt-4 text-center font-display text-2xl font-bold text-unmute-navy">
        Final standings
      </h2>
      <p className="mt-2 text-center font-body text-sm text-slate">
        Total rounds played: {state.total_rounds_played}
      </p>

      <ol className="mt-10 space-y-3">
        {ranked.map((p, i) => (
          <li
            key={p.id}
            className={`flex items-center justify-between rounded-lg border px-4 py-3 font-body text-base ${
              p.id === topId
                ? "border-signal-amber/80 bg-signal-amber/15 text-deep-navy"
                : "border-cloud-grey bg-warm-white text-charcoal"
            }`}
          >
            <span className="text-slate">{i + 1}.</span>
            <span className="flex-1 px-3 font-medium">{p.display_name}</span>
            <span className="font-mono text-sm">{p.score}</span>
          </li>
        ))}
      </ol>

      {surprising && surprisingAuthor ? (
        <div className="mt-10 rounded-lg border border-cloud-grey bg-warm-white p-5 shadow-sm">
          <p className="font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
            Most surprising
          </p>
          <p className="mt-3 font-body text-sm text-charcoal">
            “{surprising.text.slice(0, 120)}
            {surprising.text.length > 120 ? "…" : ""}”
          </p>
          <p className="mt-2 font-body text-xs text-slate">
            — {surprisingAuthor.display_name}
          </p>
        </div>
      ) : null}

      {role === "lead" ? (
        <button
          type="button"
          onClick={() => void sendAction("endSession", {})}
          className="mt-12 w-full rounded-md bg-signal-amber py-4 font-display text-base font-semibold text-warm-white transition-colors hover:bg-sunrise-gold"
        >
          End Session
        </button>
      ) : null}
    </div>
  );
};
