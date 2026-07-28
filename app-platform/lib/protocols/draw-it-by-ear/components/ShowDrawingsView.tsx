"use client";

import { useCallback, useRef } from "react";
import { TimerArc } from "@/components/ui/TimerArc";
import type { SessionParticipantRole } from "@/lib/types/database";
import { getActiveDescriberId } from "../engine";
import type { DibeState } from "../types";

type ShowDrawingsViewProps = {
  state: DibeState;
  participantId: string;
  role: SessionParticipantRole;
  sendAction: (type: string, payload: object) => Promise<void>;
};

export const ShowDrawingsView = ({
  state,
  participantId,
  role,
  sendAction,
}: ShowDrawingsViewProps) => {
  const firedRef = useRef(false);
  const isDescriber = getActiveDescriberId(state, participantId) === participantId;

  const armedPhase = state.phase;

  const handleTimerComplete = useCallback(async () => {
    if (firedRef.current) return;
    firedRef.current = true;
    await sendAction("showDrawingsTimerExpired", { armedPhase });
  }, [sendAction, armedPhase]);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center px-5 py-12">
      <h1 className="text-center font-display text-2xl font-bold text-unmute-navy">
        {isDescriber
          ? "As the describer, you have nothing to hold up. Take a look at what everyone drew."
          : "Hold your drawing up to the camera so everyone can see what you made."}
      </h1>

      <div className="mt-10">
        <TimerArc
          durationSeconds={state.timer_duration_seconds}
          startedAt={state.timer_started_at}
          onComplete={() => void handleTimerComplete()}
          size={168}
        />
      </div>

      {role === "lead" ? (
        <button
          type="button"
          onClick={() => void sendAction("skipShowDrawings", {})}
          className="mt-10 w-full rounded-md border border-cloud-grey px-5 py-4 font-display text-base font-semibold text-unmute-navy transition-colors hover:bg-cloud-grey"
        >
          Skip ahead
        </button>
      ) : null}
    </div>
  );
};
