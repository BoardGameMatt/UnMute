"use client";

import { ScoringCriteriaForm } from "./ScoringCriteriaForm";
import type { DibePhase, DibeState } from "../types";

type RoundScoringViewProps = {
  state: DibeState;
  sessionId: string;
  participantId: string;
  sendAction: (type: string, payload: object) => Promise<void>;
};

const tierForPhase = (phase: DibePhase): string | undefined => {
  if (phase === "ROUND_SCORING_1PT") return "1 of 3";
  if (phase === "ROUND_SCORING_2PT") return "2 of 3";
  if (phase === "ROUND_SCORING_3PT") return "3 of 3";
  return undefined;
};

export const RoundScoringView = ({
  state,
  sessionId,
  participantId,
  sendAction,
}: RoundScoringViewProps) => (
  <ScoringCriteriaForm
    key={state.phase}
    sessionId={sessionId}
    criteria={state.active_criteria}
    timerStartedAt={state.timer_started_at}
    timerDurationSeconds={state.timer_duration_seconds}
    participantId={participantId}
    imageName={state.active_image_name}
    existingAnswers={state.scoring_submissions[participantId]}
    tierLabel={tierForPhase(state.phase)}
    sendAction={sendAction}
  />
);
