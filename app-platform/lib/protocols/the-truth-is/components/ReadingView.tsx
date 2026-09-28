"use client";

import { useEffect, useState } from "react";
import { WaoPlayTimer } from "@/lib/protocols/wrong-answers-only/components/WaoPlayTimer";
import { READER_CONVERSATION_PROMPTS } from "../conversation-prompts";
import type { TruthIsClientAction, TruthIsPlayState } from "../types";
import { BluffRulesBanner } from "./BluffRulesBanner";

type ReadingViewProps = {
  state: TruthIsPlayState;
  pending: boolean;
  send: (action: TruthIsClientAction) => Promise<boolean>;
};

export const ReadingView = ({ state, pending, send }: ReadingViewProps) => {
  const [promptIndex, setPromptIndex] = useState(0);

  useEffect(() => {
    if (!state.youAreReader) return;
    const id = window.setInterval(() => {
      setPromptIndex((n) => (n + 1) % READER_CONVERSATION_PROMPTS.length);
    }, 15_000);
    return () => window.clearInterval(id);
  }, [state.youAreReader]);

  if (!state.currentReaderName) {
    return (
      <div className="px-5 py-12 text-center font-body text-slate">Preparing the next reading…</div>
    );
  }

  const prompt = READER_CONVERSATION_PROMPTS[promptIndex] ?? READER_CONVERSATION_PROMPTS[0];

  return (
    <div className="flex min-h-[70vh] flex-col px-5 pb-10 pt-6">
      <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
        {state.youAreReader ? "YOUR TURN TO READ" : "LISTENING"}
      </p>
      {state.youAreAuthor ? (
        <div className="mt-6">
          <BluffRulesBanner />
        </div>
      ) : null}

      {state.youAreReader ? (
        <>
          <p className="mt-4 text-center font-body text-sm text-slate">
            Read this out loud to your team.
          </p>
          <p className="mx-auto max-w-3xl py-8 text-center font-display text-4xl font-bold leading-tight text-unmute-navy sm:text-[2.5rem]">
            {state.currentEntryText}
          </p>
          <p className="text-center font-body text-sm text-charcoal">{prompt}</p>
        </>
      ) : (
        <p className="mt-6 text-center font-display text-xl font-semibold text-unmute-navy">
          Listening to {state.currentReaderName}
        </p>
      )}

      {state.instruction ? (
        <p className="mx-auto mt-6 max-w-md text-center font-body text-sm text-charcoal">
          {state.instruction}
        </p>
      ) : null}

      <div className="mt-10 flex flex-col items-center gap-6">
        <WaoPlayTimer
          durationSeconds={state.timerDurationSeconds || 180}
          startedAt={state.timerStartedAt}
          onComplete={() => void send({ type: "timerExpired" })}
        />
        {state.youAreReader ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => void send({ type: "readyToVote" })}
            className="w-full max-w-md rounded-md bg-signal-amber px-6 py-4 font-display text-lg font-semibold text-deep-navy transition-colors hover:bg-sunrise-gold disabled:cursor-not-allowed disabled:opacity-40"
          >
            Ready to vote
          </button>
        ) : null}
      </div>
    </div>
  );
};
