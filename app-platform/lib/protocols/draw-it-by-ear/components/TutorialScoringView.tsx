"use client";

import { ScoringCriteriaForm } from "./ScoringCriteriaForm";
import type { DibeState } from "../types";

type TutorialScoringViewProps = {
  state: DibeState;
  participantId: string;
  sendAction: (type: string, payload: object) => Promise<void>;
};

export const TutorialScoringView = ({
  state,
  participantId,
  sendAction,
}: TutorialScoringViewProps) => (
  <ScoringCriteriaForm
    criteria={state.active_criteria}
    timerStartedAt={state.timer_started_at}
    timerDurationSeconds={state.timer_duration_seconds}
    participantId={participantId}
    existingAnswers={state.scoring_submissions[participantId]}
    sendAction={sendAction}
  />
);
