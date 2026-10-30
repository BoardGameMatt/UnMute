"use client";

import type { SessionParticipantRole } from "@/lib/types/database";
import type { DibeState } from "../types";

type LeaderboardViewProps = {
  state: DibeState;
  role: SessionParticipantRole;
  sendAction: (type: string, payload: object) => Promise<void>;
};

export const LeaderboardView = ({ state, role, sendAction }: LeaderboardViewProps) => {
  const ranked = [...state.teams].sort((a, b) => b.cumulative_score - a.cumulative_score);
  const topId = ranked[0]?.id;
  const maxRounds = state.progress_total_rounds;
  const isLastRound = state.total_rounds_played >= maxRounds;

  return (
    <div className="min-h-[70vh] px-5 py-10">
      <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
        LEADERBOARD
      </p>
      <h1 className="mt-4 text-center font-display text-2xl font-bold text-unmute-navy">
        Team standings
      </h1>
      <ul className="mx-auto mt-8 max-w-md space-y-3">
        {ranked.map((team) => (
          <li
            key={team.id}
            className={`flex items-center justify-between rounded-lg border px-4 py-3 shadow-sm ${
              team.id === topId
                ? "border-signal-amber bg-signal-amber/10"
                : "border-cloud-grey bg-warm-white"
            }`}
            style={{ borderLeftWidth: 4, borderLeftColor: team.color }}
          >
            <span className="font-display font-semibold text-unmute-navy">{team.name}</span>
            <span className="font-mono text-sm text-charcoal">{team.cumulative_score}</span>
          </li>
        ))}
      </ul>
      {role === "lead" ? (
        <button
          type="button"
          onClick={() =>
            void sendAction(isLastRound ? "endSession" : "dismissLeaderboard", {})
          }
          className="mx-auto mt-10 block w-full max-w-sm rounded-md bg-signal-amber px-5 py-4 font-display text-base font-semibold text-deep-navy hover:bg-sunrise-gold"
        >
          {isLastRound ? "End Session" : "Next Round"}
        </button>
      ) : null}
    </div>
  );
};
