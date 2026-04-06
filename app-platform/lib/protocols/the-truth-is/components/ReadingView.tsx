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

/** Verbal facilitator cue — Outfit, prominent on every discussion screen. */
const DiscussionFacilitatorCue = () => (
  <h2 className="mt-6 text-center font-display text-2xl font-semibold leading-snug text-unmute-navy sm:text-[26px]">
    Who do you think said this?
  </h2>
);

type BluffRulesCardProps = {
  onDismiss: () => void;
};

const BluffRulesCard = ({ onDismiss }: BluffRulesCardProps) => {
  useEffect(() => {
    const t = window.setTimeout(() => onDismiss(), 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <button
      type="button"
      onClick={onDismiss}
      className="w-full rounded-lg border-l-4 border-signal-amber bg-deep-navy p-5 text-left shadow-sm transition hover:bg-deep-navy/95 active:scale-[0.99]"
    >
      <p className="font-display text-xl font-semibold text-warm-white">This one&apos;s yours.</p>
      <div className="mt-4 space-y-2 font-mono text-[11px] font-normal leading-relaxed text-warm-white/95 sm:text-xs">
        <p>You score no points for your own statement.</p>
        <p>You earn +1 for each person who guesses someone else.</p>
        <p>If nobody picks you at all — bonus point.</p>
      </div>
      <p className="mt-4 font-body text-xs text-warm-white/70">Tap anywhere to continue</p>
    </button>
  );
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

  const dismissBluffRules = useCallback(() => {
    void sendAction("dismissBluffRules", {});
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

  if (state.phase === "BLUFF_RULES") {
    if (isReader) {
      return (
        <div className="flex min-h-[70vh] flex-col px-5 pb-8 pt-6">
          <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
            YOUR STATEMENT
          </p>
          <p className="mt-4 text-center font-display text-xl font-semibold leading-snug text-charcoal">
            {entry.text}
          </p>
          <div className="mt-8">
            <BluffRulesCard onDismiss={dismissBluffRules} />
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-[70vh] flex-col items-center px-6 pb-10 pt-6 text-center">
        <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
          LISTENING
        </p>
        <p className="mt-4 text-center font-display text-xl font-semibold leading-snug text-charcoal">
          {entry.text}
        </p>
        <DiscussionFacilitatorCue />
        <p className="mt-6 font-body text-sm text-slate">
          Waiting for {reader.display_name} — discussion starts in a moment.
        </p>
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
          <p className="mt-4 text-center font-display text-xl font-semibold leading-snug text-charcoal">
            {entry.text}
          </p>
          <DiscussionFacilitatorCue />
          <p className="mt-4 text-center font-body text-base text-slate">
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
        <DiscussionFacilitatorCue />
        <p className="mt-4 font-body text-sm text-slate">Discussion in progress.</p>
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
