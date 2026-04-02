"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TimerArc } from "@/components/ui/TimerArc";
import { READER_CONVERSATION_PROMPTS } from "../conversation-prompts";
import type { TruthIsState } from "../types";

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
  const [promptIndex, setPromptIndex] = useState(0);

  const onDiscussionTimer = useCallback(() => {
    void sendAction("discussionTimerExpired", {});
  }, [sendAction]);

  /** Legacy sessions may still be in READING_ASSIGNMENT; advance to DISCUSSION with timer. */
  useEffect(() => {
    if (state.phase !== "READING_ASSIGNMENT") return;
    void sendAction("startDiscussion", {});
  }, [state.phase, sendAction]);

  useEffect(() => {
    if (state.phase !== "DISCUSSION") return;
    const t = window.setInterval(() => {
      setPromptIndex((i) => (i + 1) % READER_CONVERSATION_PROMPTS.length);
    }, 15000);
    return () => clearInterval(t);
  }, [state.phase]);

  useEffect(() => {
    setPromptIndex(0);
  }, [state.current_entry_id]);

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

  if (state.phase === "DISCUSSION") {
    if (isReader) {
      return (
        <div className="flex min-h-[70vh] flex-col px-5 pb-8 pt-6">
          <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
            DISCUSSION
          </p>
          <p className="mt-6 text-center font-display text-xl font-semibold leading-snug text-charcoal">
            {entry.text}
          </p>
          <p className="mt-8 text-center font-body text-base text-slate">
            Read this out loud and start discussing.
          </p>
          <div className="mt-8 rounded-lg border border-cloud-grey bg-warm-white p-5 shadow-sm">
            <p className="font-body text-sm leading-relaxed text-charcoal">
              {READER_CONVERSATION_PROMPTS[promptIndex]}
            </p>
          </div>
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
        <p className="font-display text-xl font-semibold text-unmute-navy">
          Listening to {reader.display_name}
        </p>
        <p className="mt-3 font-body text-sm text-slate">Discussion in progress.</p>
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
