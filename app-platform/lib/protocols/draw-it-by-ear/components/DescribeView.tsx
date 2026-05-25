"use client";

import { useCallback, useRef } from "react";
import { TimerArc } from "@/components/ui/TimerArc";
import { isDescriberForActiveRound } from "../engine";
import { useDibeImage } from "../hooks/useDibeImage";
import type { DibeState } from "../types";

type DescribeViewProps = {
  state: DibeState;
  sessionId: string;
  participantId: string;
  sendAction: (type: string, payload: object) => Promise<void>;
  tutorial?: boolean;
};

export const DescribeView = ({
  state,
  sessionId,
  participantId,
  sendAction,
  tutorial = false,
}: DescribeViewProps) => {
  const isDescriber = isDescriberForActiveRound(state, participantId);
  const firedRef = useRef(false);
  const { signedUrl, loading, error } = useDibeImage(
    sessionId,
    participantId,
    isDescriber
  );

  const handleTimerComplete = useCallback(async () => {
    if (firedRef.current) return;
    firedRef.current = true;
    await sendAction("describeTimerExpired", {});
  }, [sendAction]);

  if (isDescriber) {
    return (
      <div className="flex min-h-[80vh] flex-col px-4 pb-8 pt-4">
        {loading ? (
          <p className="flex flex-1 items-center justify-center font-body text-slate">
            Loading image…
          </p>
        ) : error ? (
          <p
            className="flex flex-1 items-center justify-center font-body text-signal-red"
            role="alert"
          >
            {error}
          </p>
        ) : signedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={signedUrl}
            alt={state.active_image_name ?? "Describe this image"}
            className="mx-auto max-h-[55vh] w-full max-w-lg object-contain"
          />
        ) : null}
        <div className="mt-6 flex justify-center">
          <TimerArc
            durationSeconds={state.timer_duration_seconds}
            startedAt={state.timer_started_at}
            onComplete={() => void handleTimerComplete()}
            size={140}
          />
        </div>
        <p className="mt-4 text-center font-mono text-xs uppercase tracking-widest text-steel-blue">
          Describe what you see
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-5 pb-10">
      <p className="font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
        {tutorial ? "TUTORIAL" : `ROUND ${state.current_round}`}
      </p>
      <h1 className="mt-6 max-w-sm text-center font-display text-2xl font-bold text-unmute-navy">
        Listen carefully and draw what you hear
      </h1>
      <p className="mt-3 max-w-xs text-center font-body text-sm text-slate">
        Draw on paper — not on your screen. Don&apos;t peek at other screens!
      </p>
      <div className="mt-10">
        <TimerArc
          durationSeconds={state.timer_duration_seconds}
          startedAt={state.timer_started_at}
          onComplete={() => void handleTimerComplete()}
          size={168}
        />
      </div>
      <p className="mt-6 font-mono text-sm uppercase tracking-widest text-unmute-navy">
        {state.timer_duration_seconds}s
      </p>
    </div>
  );
};
