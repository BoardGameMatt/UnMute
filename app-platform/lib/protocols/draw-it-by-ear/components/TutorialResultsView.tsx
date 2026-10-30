"use client";

import type { SessionParticipantRole } from "@/lib/types/database";
import { CriterionBarChart } from "./CriterionBarChart";
import type { DibeState } from "../types";

type TutorialResultsViewProps = {
  state: DibeState;
  role: SessionParticipantRole;
  sendAction: (type: string, payload: object) => Promise<void>;
};

export const TutorialResultsView = ({
  state,
  role,
  sendAction,
}: TutorialResultsViewProps) => {
  return (
    <div className="min-h-[70vh] px-5 py-10">
      <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
        TUTORIAL RESULTS
      </p>
      <h1 className="mt-4 text-center font-display text-2xl font-bold text-unmute-navy">
        How did everyone do?
      </h1>
      <p className="mt-2 text-center font-body text-sm text-slate">
        Aggregate responses — no points recorded.
      </p>
      <div className="mt-8">
        <CriterionBarChart
          criterionHits={state.round_criterion_hits}
          maxParticipants={state.participants.length}
        />
      </div>
      {role === "lead" ? (
        <button
          type="button"
          onClick={() => void sendAction("startTeamFormation", {})}
          className="mt-10 w-full rounded-md bg-signal-amber px-5 py-4 font-display text-base font-semibold text-deep-navy transition-colors hover:bg-sunrise-gold"
        >
          Form Teams
        </button>
      ) : null}
    </div>
  );
};
