"use client";

import { useCallback, useRef } from "react";
import { TimerArc } from "@/components/ui/TimerArc";
import {
  getActiveDescriberDisplayName,
  getBreakoutRoundStart,
  isDescriberForActiveRound,
  isRoomDrawingComplete,
} from "../engine";
import { useCountdownSeconds } from "../hooks/useCountdownSeconds";
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
  const describerName = getActiveDescriberDisplayName(state, participantId);
  const firedRef = useRef(false);

  // Tutorial keeps the original session-wide start; rounds gate per breakout room.
  const roundStart = tutorial ? null : getBreakoutRoundStart(state, participantId);
  const countdownSeconds = useCountdownSeconds(roundStart?.drawing_started_at ?? null);

  const roomComplete = !tutorial && isRoomDrawingComplete(state, participantId);
  const awaitingGo = !tutorial && !roundStart;
  const inCountdown = !tutorial && Boolean(roundStart) && countdownSeconds > 0;
  const drawingActive =
    tutorial || (Boolean(roundStart) && countdownSeconds === 0 && !roomComplete);

  const timerStartedAt = tutorial
    ? state.timer_started_at
    : roundStart?.drawing_started_at ?? null;

  const { signedUrl, loading, error } = useDibeImage(
    sessionId,
    participantId,
    isDescriber && drawingActive
  );

  // Snapshot of the phase this view was rendered under — the timer belongs to it,
  // even if the session has moved on by the time the post lands.
  const armedPhase = state.phase;

  // On ROUND_DESCRIBE this marks only the poster's room complete; the session
  // advances once the last room that started is marked.
  const handleTimerComplete = useCallback(async () => {
    if (firedRef.current) return;
    firedRef.current = true;
    await sendAction("describeTimerExpired", { armedPhase, participantId });
  }, [sendAction, armedPhase, participantId]);

  const handleGo = useCallback(async () => {
    await sendAction("startBreakoutRound", { participantId });
  }, [sendAction, participantId]);

  if (awaitingGo) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-5 pb-10">
        {isDescriber ? (
          <>
            <h1 className="max-w-sm text-center font-display text-2xl font-bold text-unmute-navy">
              You&apos;re describing this round
            </h1>
            <p className="mt-3 max-w-xs text-center font-body text-sm text-slate">
              Everyone in your room starts together when you&apos;re ready.
            </p>
            <button
              type="button"
              onClick={() => void handleGo()}
              className="mt-10 w-full max-w-sm rounded-md bg-signal-amber px-5 py-4 font-display text-base font-semibold text-deep-navy transition-colors hover:bg-sunrise-gold"
            >
              Go
            </button>
          </>
        ) : (
          <p className="max-w-sm text-center font-display text-xl font-semibold text-unmute-navy">
            Waiting for {describerName ?? "the describer"} to start.
          </p>
        )}
      </div>
    );
  }

  if (inCountdown) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-5 pb-10">
        <p className="font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
          STARTING
        </p>
        <p
          aria-live="polite"
          className="mt-6 font-display text-7xl font-bold text-unmute-navy"
        >
          {countdownSeconds}
        </p>
      </div>
    );
  }

  if (roomComplete) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-5 pb-10">
        <p className="font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
          Pencils down
        </p>
        <h1 className="mt-6 max-w-sm text-center font-display text-2xl font-bold text-unmute-navy">
          Other rooms are still drawing.
        </h1>
        <p className="mt-3 max-w-xs text-center font-body text-sm text-slate">
          Your room is finished. Hang on to your drawing — everyone moves on
          together.
        </p>
      </div>
    );
  }

  if (isDescriber) {
    return (
      <div className="flex min-h-[80vh] flex-col px-4 pb-8 pt-4">
        {describerName ? (
          <p className="mb-4 text-center font-display text-lg font-semibold text-unmute-navy">
            {tutorial
              ? `${describerName} is describing the practice round.`
              : `${describerName} is describing this round.`}
          </p>
        ) : null}
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
            startedAt={timerStartedAt}
            onComplete={() => void handleTimerComplete()}
            size={140}
          />
        </div>
        <p className="mt-4 text-center font-body text-sm text-slate">
          Describe what you see
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-5 pb-10">
      {describerName ? (
        <p className="text-center font-display text-xl font-semibold text-unmute-navy">
          {tutorial
            ? `${describerName} is describing the practice round.`
            : `${describerName} is describing this round.`}
        </p>
      ) : null}
      <h1
        className={`max-w-sm text-center font-display text-2xl font-bold text-unmute-navy ${
          describerName ? "mt-6" : "mt-0"
        }`}
      >
        Listen carefully and draw what you hear
      </h1>
      <p className="mt-3 max-w-xs text-center font-body text-sm text-slate">
        Draw on paper — not on your screen. Don&apos;t peek at other screens!
      </p>
      <div className="mt-10">
        <TimerArc
          durationSeconds={state.timer_duration_seconds}
          startedAt={timerStartedAt}
          onComplete={() => void handleTimerComplete()}
          size={168}
        />
      </div>
    </div>
  );
};
