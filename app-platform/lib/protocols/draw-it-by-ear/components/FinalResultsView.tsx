"use client";

import type { SessionParticipantRole } from "@/lib/types/database";
import { getMostPreciseDrawerId, getMvpDescriberId } from "../engine";
import type { DibeState } from "../types";

type FinalResultsViewProps = {
  state: DibeState;
  role: SessionParticipantRole;
  sendAction: (type: string, payload: object) => Promise<void>;
};

export const FinalResultsView = ({
  state,
  role,
  sendAction,
}: FinalResultsViewProps) => {
  const ranked = [...state.teams].sort((a, b) => b.cumulative_score - a.cumulative_score);
  const topId = ranked[0]?.id;
  const mvpId = getMvpDescriberId(state);
  const drawerId = getMostPreciseDrawerId(state);
  const mvpName = state.participants.find((p) => p.id === mvpId)?.display_name;
  const drawerName = state.participants.find((p) => p.id === drawerId)?.display_name;

  return (
    <div className="min-h-[70vh] px-5 py-10">
      <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
        FINAL RESULTS
      </p>
      <h1 className="mt-4 text-center font-display text-3xl font-bold text-unmute-navy">
        Final scores
      </h1>
      <ul className="mx-auto mt-8 max-w-md space-y-3">
        {ranked.map((team, i) => (
          <li
            key={team.id}
            className={`flex items-center justify-between rounded-lg border px-4 py-3 shadow-sm ${
              team.id === topId
                ? "border-signal-amber bg-signal-amber/10"
                : "border-cloud-grey bg-warm-white"
            }`}
            style={{ borderLeftWidth: 4, borderLeftColor: team.color }}
          >
            <span className="font-body text-slate">{i + 1}.</span>
            <span className="flex-1 px-3 font-display font-semibold text-unmute-navy">
              {team.name}
            </span>
            <span className="font-mono text-sm">{team.cumulative_score}</span>
          </li>
        ))}
      </ul>
      <div className="mx-auto mt-10 max-w-md space-y-4 rounded-lg border border-cloud-grey bg-warm-white p-6 shadow-sm">
        {mvpName ? (
          <p className="font-body text-sm text-charcoal">
            <span className="font-mono text-[10px] uppercase tracking-widest text-signal-amber">
              MVP Describer
            </span>
            <br />
            {mvpName}
          </p>
        ) : null}
        {drawerName ? (
          <p className="font-body text-sm text-charcoal">
            <span className="font-mono text-[10px] uppercase tracking-widest text-signal-amber">
              Most Precise Drawer
            </span>
            <br />
            {drawerName}
          </p>
        ) : null}
      </div>
      {role === "lead" ? (
        <button
          type="button"
          onClick={() => void sendAction("endSession", {})}
          className="mx-auto mt-10 block w-full max-w-sm rounded-md bg-signal-amber px-5 py-4 font-display text-base font-semibold text-deep-navy hover:bg-sunrise-gold"
        >
          End Session
        </button>
      ) : null}
    </div>
  );
};
