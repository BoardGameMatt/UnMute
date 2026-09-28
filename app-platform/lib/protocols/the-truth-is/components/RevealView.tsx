"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { TruthIsClientAction, TruthIsPlayState, TruthIsRevealView } from "../types";

type RevealViewProps = {
  state: TruthIsPlayState;
  send: (action: TruthIsClientAction) => Promise<boolean>;
};

type Step = "votes" | "author" | "points";

const EASE = [0.4, 0, 0.2, 1] as const;

export const RevealView = ({ state, send }: RevealViewProps) => {
  const reveal = state.reveal;
  const reduce = useReducedMotion();
  const [step, setStep] = useState<Step>(reduce ? "points" : "votes");
  const sentRef = useRef(false);

  useEffect(() => {
    if (!reveal || reduce) return;
    if (step === "votes") {
      const t = window.setTimeout(() => setStep("author"), 2200);
      return () => window.clearTimeout(t);
    }
    if (step === "author") {
      const t = window.setTimeout(() => setStep("points"), 2200);
      return () => window.clearTimeout(t);
    }
    return;
  }, [reduce, reveal, step]);

  useEffect(() => {
    if (!reveal) return;
    const delay = reduce ? 2500 : step === "points" ? 2200 : 8000;
    if (!reduce && step !== "points") return;
    const t = window.setTimeout(() => {
      if (sentRef.current) return;
      sentRef.current = true;
      void send({ type: "processReveal" });
    }, delay);
    return () => window.clearTimeout(t);
  }, [reduce, reveal, send, step]);

  useEffect(() => {
    if (!state.timerStartedAt || state.timerDurationSeconds <= 0) return;
    const delay =
      Date.parse(state.timerStartedAt) + state.timerDurationSeconds * 1000 - Date.now();
    const t = window.setTimeout(() => void send({ type: "timerExpired" }), Math.max(0, delay + 200));
    return () => window.clearTimeout(t);
  }, [send, state.timerDurationSeconds, state.timerStartedAt]);

  if (!reveal) {
    return <p className="px-5 py-12 text-center font-body text-slate">Revealing…</p>;
  }

  if (reduce) {
    return (
      <div className="min-h-[50vh] space-y-8 px-5 py-8">
        <GuessList reveal={reveal} />
        <AuthorName name={reveal.authorName} />
        <Points reveal={reveal} />
      </div>
    );
  }

  return (
    <motion.div
      key={step}
      className="min-h-[50vh] px-5 py-8"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      {step === "votes" ? <GuessList reveal={reveal} /> : null}
      {step === "author" ? <AuthorName name={reveal.authorName} /> : null}
      {step === "points" ? <Points reveal={reveal} /> : null}
    </motion.div>
  );
};

function GuessList({ reveal }: { reveal: TruthIsRevealView }) {
  return (
    <div>
      <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
        The guesses
      </p>
      <ul className="mt-8 space-y-3 font-body text-sm text-charcoal">
        {reveal.votes.length === 0 ? (
          <li className="text-slate">No votes recorded this round.</li>
        ) : (
          reveal.votes.map((row) => (
            <li key={`${row.voterName}-${row.guessedName}`}>
              <span className="font-medium">{row.voterName}</span>
              {" guessed "}
              <span className="text-unmute-navy">{row.guessedName}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function AuthorName({ name }: { name: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center">
      <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
        The author
      </p>
      <p className="mt-8 text-center font-display text-3xl font-semibold text-deep-navy">{name}</p>
    </div>
  );
}

function Points({ reveal }: { reveal: TruthIsRevealView }) {
  return (
    <div>
      <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
        Points this round
      </p>
      {reveal.isBluff ? (
        <div className="mx-auto mt-6 max-w-md space-y-4 text-center">
          <p className="font-body text-base text-charcoal">That was {reveal.authorName}&apos;s own statement.</p>
          {reveal.authorBluffed ? (
            <p className="font-mono text-sm text-unmute-navy">Perfect bluff. +1 bonus.</p>
          ) : null}
          <ul className="space-y-2 font-body text-base text-charcoal">
            {reveal.caughtNames.map((name) => (
              <li key={`caught-${name}`}>
                {name} caught it <span className="font-mono text-unmute-navy">+1</span>
              </li>
            ))}
            {reveal.authorPoints > 0 ? (
              <li>
                {reveal.authorName}{" "}
                <span className="font-mono text-unmute-navy">+{reveal.authorPoints}</span>
              </li>
            ) : (
              <li className="text-slate">They saw right through it.</li>
            )}
          </ul>
        </div>
      ) : (
        <div className="mt-8 space-y-3 text-center font-body text-base text-charcoal">
          {reveal.correctGuesserNames.length === 0 ? (
            <p className="text-slate">No one guessed the author this round.</p>
          ) : (
            reveal.correctGuesserNames.map((name) => (
              <p key={name}>
                <span className="font-medium">{name}</span> guessed right{" "}
                <span className="font-mono text-unmute-navy">+1</span>
              </p>
            ))
          )}
        </div>
      )}
    </div>
  );
}
