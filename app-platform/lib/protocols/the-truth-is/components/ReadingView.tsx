"use client";

import { useCallback, useEffect, useMemo } from "react";
import { TimerArc } from "@/components/ui/TimerArc";
import type { TruthIsState } from "../types";
import { BluffRulesBanner } from "./BluffRulesBanner";

type ReadingViewProps = {
  state: TruthIsState;
  participantId: string;
  sendAction: (type: string, payload: object) => Promise<void>;
};

export const ReadingView = ({ state, participantId, sendAction }: ReadingViewProps) => {
  const entry = useMemo(
    () => state.entries.find((e) => e.id === state.current_entry_id),
    [state.entries, state.current_entry_id]
  );

  const reader = useMemo(
    () => state.participants.find((p) => p.id === state.current_reader_id),
    [state.participants, state.current_reader_id]
  );

  const isReader = state.current_reader_id === participantId;
  const isBluffRound =
    state.current_reader_id !== null &&
    state.current_author_id !== null &&
    state.current_reader_id === state.current_author_id;
  const showBluffBanner = isReader && isBluffRound;

  const onDiscussionTimer = useCallback(() => {
    void sendAction("discussionTimerExpired", {});
  }, [sendAction]);

  /** Legacy sessions stuck in BLUFF_RULES — sync to DISCUSSION + timer. */
  useEffect(() => {
    if (state.phase !== "BLUFF_RULES") return;
    void sendAction("dismissBluffRules", {});
  }, [state.phase, sendAction]);

  /** Legacy READING_ASSIGNMENT → DISCUSSION with timer. */
  useEffect(() => {
    if (state.phase !== "READING_ASSIGNMENT") return;
    void sendAction("startDiscussion", {});
  }, [state.phase, sendAction]);

  const inDiscussionUi =
    state.phase === "DISCUSSION" || state.phase === "BLUFF_RULES";

  if (!entry || !reader) {
    return (
      <div className="px-5 py-12 text-center font-body text-slate">
        Preparing the next reading…
      </div>
    );
  }

  if (state.phase === "READING_ASSIGNMENT") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
        <p className="font-body text-slate">Starting discussion…</p>
      </div>
    );
  }

  if (inDiscussionUi) {
    if (isReader) {
      return (
        <div className="flex min-h-[70vh] flex-col px-5 pb-10 pt-6">
          <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
            DISCUSSION
          </p>
          {showBluffBanner ? <BluffRulesBanner /> : null}

          <p className="text-center font-mono text-xs font-normal uppercase tracking-widest text-steel-blue">
            Read the following out loud, then discuss
          </p>

          <p className="mx-auto max-w-3xl py-10 text-center font-display text-4xl font-bold leading-tight text-unmute-navy sm:py-12 sm:text-[2.5rem] sm:leading-tight">
            {entry.text}
          </p>

          <p className="text-center font-body text-sm font-normal text-slate">
            Try and figure out who said this
          </p>

          <div className="mt-10 flex justify-center">
            <TimerArc
              durationSeconds={state.timer_duration_seconds || 30}
              startedAt={state.timer_started_at}
              onComplete={onDiscussionTimer}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 pb-10 text-center">
        <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
          LISTENING
        </p>
        <p className="mt-4 font-display text-xl font-semibold text-unmute-navy">
          Listening to {reader.display_name}
        </p>
        <p className="mt-6 max-w-xl font-body text-sm text-slate">
          Try and figure out who said this
        </p>
        <div className="mt-10">
          <TimerArc
            durationSeconds={state.timer_duration_seconds || 30}
            startedAt={state.timer_started_at}
            onComplete={onDiscussionTimer}
          />
        </div>
      </div>
    );
  }

  return null;
};
