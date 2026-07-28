"use client";

import { ScoringCriteriaForm } from "./ScoringCriteriaForm";
import type { DibeState } from "../types";

type TutorialScoringViewProps = {
  state: DibeState;
  sessionId: string;
  participantId: string;
  sendAction: (type: string, payload: object) => Promise<void>;
};

export const TutorialScoringView = ({
  state,
  sessionId,
  participantId,
  sendAction,
}: TutorialScoringViewProps) => (
  <ScoringCriteriaForm
    sessionId={sessionId}
    phase={state.phase}
    criteria={state.active_criteria}
    timerStartedAt={state.timer_started_at}
    timerDurationSeconds={state.timer_duration_seconds}
    participantId={participantId}
    imageName={state.active_image_name}
    existingAnswers={state.scoring_submissions[participantId]}
    sendAction={sendAction}
  />
);
