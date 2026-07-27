"use client";

import type { SessionParticipantRole } from "@/lib/types/database";
import { CriterionBarChart } from "./CriterionBarChart";
import type { DibeState } from "../types";

type RoundAggregateViewProps = {
  state: DibeState;
  role: SessionParticipantRole;
  sendAction: (type: string, payload: object) => Promise<void>;
};

export const RoundAggregateView = ({
  state,
  role,
  sendAction,
}: RoundAggregateViewProps) => {
  const lastRound = state.rounds[state.rounds.length - 1];

  return (
    <div className="min-h-[70vh] px-5 py-10">
      <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
        ROUND {state.total_rounds_played} AGGREGATE
      </p>
      <h1 className="mt-4 text-center font-display text-2xl font-bold text-unmute-navy">
        How accurate was the room?
      </h1>
      <div className="mt-8">
        <CriterionBarChart
          criterionHits={lastRound?.criterion_hits ?? state.round_criterion_hits}
          maxParticipants={state.participants.length}
        />
      </div>
      <div className="mt-10 space-y-3">
        {state.teams.map((team) => (
          <div
            key={team.id}
            className="flex items-center justify-between rounded-lg border border-cloud-grey bg-warm-white px-4 py-3 shadow-sm"
            style={{ borderLeftWidth: 4, borderLeftColor: team.color }}
          >
            <span className="font-display font-semibold text-unmute-navy">{team.name}</span>
            <span className="font-mono text-sm text-charcoal">
              Round: {lastRound?.team_round_scores[team.id] ?? 0} · Total: {team.cumulative_score}
            </span>
          </div>
        ))}
      </div>
      {role === "lead" ? (
        <button
          type="button"
          onClick={() => void sendAction("advanceFromAggregate", {})}
          className="mt-10 w-full rounded-md bg-signal-amber px-5 py-4 font-display text-base font-semibold text-deep-navy hover:bg-sunrise-gold"
        >
          Continue
        </button>
      ) : null}
    </div>
  );
};
