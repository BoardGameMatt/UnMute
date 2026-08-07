"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import type { WaoItemVisualState } from "@/lib/wao/types";
import { WaoItemFace } from "./WaoItemFace";

/**
 * Easy lobby sample — teaches the mechanic, not trivia.
 * One belonger + three invented so the upside beat can show three correct
 * eliminations → 6 points (spec §3.2) vs the zero rule (§3.1).
 */
const SAMPLE = [
  { id: "mon", label: "Monday", belongs: true },
  { id: "blur", label: "Blursday", belongs: false },
  { id: "frenz", label: "Frenzday", belongs: false },
  { id: "thor", label: "Thorsday", belongs: false },
] as const;

const MY = "Y";
const PARTNER = "P";
const BELONGED_ID = "mon";

const EASE = [0.4, 0, 0.2, 1] as const;
const FADE_MS = 0.2;

/** ~20s loop: five beats ≈ 4s each. */
const BEAT_MS = 4000;
const BEAT_COUNT = 5;

type BeatIndex = 0 | 1 | 2 | 3 | 4;

const UPSIDE_STATES: Record<string, WaoItemVisualState> = {
  mon: "unselected",
  blur: "both",
  frenz: "both",
  thor: "both",
};

const PENALTY_STATES: Record<string, WaoItemVisualState> = {
  mon: "both",
  blur: "both",
  frenz: "both",
  thor: "both",
};

function ItemList({
  states,
  animate = true,
  mistakeId,
}: {
  states: Record<string, WaoItemVisualState>;
  animate?: boolean;
  mistakeId?: string;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {SAMPLE.map((item) => {
        const state = states[item.id] ?? "unselected";
        const isMistake = mistakeId === item.id;
        const face = (
          <WaoItemFace
            label={item.label}
            state={state}
            myInitial={MY}
            partnerInitial={PARTNER}
            mistake={isMistake}
            mistakeLabel={isMistake ? "belonged" : undefined}
          />
        );
        return (
          <li key={item.id}>
            {animate ? (
              <motion.div
                key={`${item.id}-${state}-${isMistake}`}
                initial={{ opacity: 0.85, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: FADE_MS, ease: EASE }}
              >
                {face}
              </motion.div>
            ) : (
              face
            )}
          </li>
        );
      })}
    </ul>
  );
}

function BeatCaption({ children }: { children: string }) {
  return (
    <p className="text-center font-body text-sm text-slate sm:text-base">
      {children}
    </p>
  );
}

function ScorePill({ score, animate = true }: { score: number; animate?: boolean }) {
  const valueClass =
    "mt-1 font-display text-2xl font-semibold text-deep-navy";
  return (
    <div className="text-center">
      <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
        Score
      </p>
      {animate ? (
        <motion.p
          key={score}
          initial={{ opacity: 0.7, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: FADE_MS, ease: EASE }}
          className={valueClass}
        >
          {score}
        </motion.p>
      ) : (
        <p className={valueClass}>{score}</p>
      )}
    </div>
  );
}

function CategoryLabel() {
  return (
    <p className="text-center font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
      Days of the week
    </p>
  );
}

/** Beat 0: phone + laptop setup (no CategoryLabel). */
function BeatSetup({ animate = true }: { animate?: boolean }) {
  const illustration = (
    <svg
      viewBox="0 0 240 150"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* laptop */}
      <rect x="30" y="22" width="150" height="94" rx="6" className="fill-unmute-navy" />
      <rect x="38" y="30" width="134" height="78" rx="3" className="fill-warm-white" />
      {/* video grid */}
      <g className="fill-unmute-navy" opacity="0.2">
        <rect x="44" y="36" width="62" height="34" rx="2" />
        <rect x="110" y="36" width="58" height="34" rx="2" />
        <rect x="44" y="74" width="62" height="30" rx="2" />
        <rect x="110" y="74" width="58" height="30" rx="2" />
      </g>
      <g className="fill-warm-white">
        <circle cx="75" cy="49" r="7" />
        <path d="M63 66c0-7 5-11 12-11s12 4 12 11z" />
        <circle cx="139" cy="49" r="7" />
        <path d="M127 66c0-7 5-11 12-11s12 4 12 11z" />
        <circle cx="75" cy="85" r="6" />
        <path d="M64 100c0-6 5-9 11-9s11 3 11 9z" />
        <circle cx="139" cy="85" r="6" />
        <path d="M128 100c0-6 5-9 11-9s11 3 11 9z" />
      </g>
      <rect x="18" y="116" width="174" height="7" rx="3.5" className="fill-unmute-navy" />
      {/* phone, foreground */}
      <rect x="150" y="52" width="62" height="98" rx="9" className="fill-deep-navy" />
      <rect x="155" y="60" width="52" height="84" rx="4" className="fill-warm-white" />
      {/* answer rows, two selected */}
      <g className="fill-unmute-navy" opacity="0.14">
        <rect x="160" y="66" width="42" height="10" rx="2" />
        <rect x="160" y="94" width="42" height="10" rx="2" />
        <rect x="160" y="122" width="42" height="10" rx="2" />
      </g>
      <g className="fill-signal-amber">
        <rect x="160" y="80" width="42" height="10" rx="2" />
        <rect x="160" y="108" width="42" height="10" rx="2" />
      </g>
    </svg>
  );

  return (
    <div className="space-y-4">
      {animate ? (
        <motion.div
          className="mx-auto w-full max-w-[240px]"
          initial={{ opacity: 0.85, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: FADE_MS, ease: EASE }}
        >
          {illustration}
        </motion.div>
      ) : (
        <div className="mx-auto w-full max-w-[240px]">{illustration}</div>
      )}
      <BeatCaption>
        Play on your phone. Keep everyone&apos;s video up on your laptop.
      </BeatCaption>
    </div>
  );
}

/** Beat 1: two wrongs tapped (mine). */
function BeatInversion({
  step,
  animate = true,
}: {
  step: number;
  animate?: boolean;
}) {
  const states: Record<string, WaoItemVisualState> = {
    mon: "unselected",
    blur: step >= 1 ? "mine" : "unselected",
    frenz: step >= 2 ? "mine" : "unselected",
    thor: "unselected",
  };
  return (
    <div className="space-y-4">
      <CategoryLabel />
      <ItemList states={states} animate={animate} />
      <BeatCaption>Tap the answers that are WRONG.</BeatCaption>
    </div>
  );
}

/** Beat 2: one item mine → both as partner arrives. */
function BeatConvergence({
  step,
  animate = true,
}: {
  step: number;
  animate?: boolean;
}) {
  const states: Record<string, WaoItemVisualState> = {
    mon: "unselected",
    blur: "unselected",
    frenz: "unselected",
    thor: step >= 1 ? "both" : "mine",
  };
  return (
    <div className="space-y-4">
      <CategoryLabel />
      <ItemList states={states} animate={animate} />
      <BeatCaption>Only what you BOTH tap counts.</BeatCaption>
    </div>
  );
}

/**
 * Beats 3–4: upside (score 6) then penalty — same panel, Monday flips
 * to the belonged/mistake treatment and score falls to 0.
 */
function BeatScore({
  showPenalty,
  animate = true,
}: {
  showPenalty: boolean;
  animate?: boolean;
}) {
  return (
    <div className="space-y-4">
      <CategoryLabel />
      <ItemList
        states={showPenalty ? PENALTY_STATES : UPSIDE_STATES}
        animate={animate}
        mistakeId={showPenalty ? BELONGED_ID : undefined}
      />
      <ScorePill score={showPenalty ? 0 : 6} animate={animate} />
      <BeatCaption>
        {showPenalty
          ? "Eliminate one correct answer and you both score nothing."
          : "The more wrong answers you both eliminate, the higher your score."}
      </BeatCaption>
    </div>
  );
}

function StaticPanels() {
  return (
    <div className="flex flex-col gap-8" aria-label="How Wrong Answers Only works">
      <BeatSetup animate={false} />
      <BeatInversion step={2} animate={false} />
      <BeatConvergence step={1} animate={false} />
      <BeatScore showPenalty={false} animate={false} />
      <BeatScore showPenalty animate={false} />
    </div>
  );
}

function AnimatedLoop() {
  const [beat, setBeat] = useState<BeatIndex>(0);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const beatTimer = window.setInterval(() => {
      setBeat((b) => ((b + 1) % BEAT_COUNT) as BeatIndex);
      setStep(0);
    }, BEAT_MS);

    return () => {
      window.clearInterval(beatTimer);
    };
  }, []);

  useEffect(() => {
    setStep(0);
    const timers: number[] = [];

    if (beat === 1) {
      timers.push(window.setTimeout(() => setStep(1), 700));
      timers.push(window.setTimeout(() => setStep(2), 1400));
    } else if (beat === 2) {
      timers.push(window.setTimeout(() => setStep(1), 900));
    }

    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [beat]);

  return (
    <div
      className="grid"
      aria-label="How Wrong Answers Only works"
      aria-live="polite"
    >
      {/*
        Same grid cell + overlapping opacity (no mode="wait") so the
        outgoing beat covers the incoming one — no blank mid-fade.
      */}
      <AnimatePresence initial={false}>
        {beat === 0 ? (
          <motion.div
            key="setup"
            className="col-start-1 row-start-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: EASE }}
          >
            <BeatSetup />
          </motion.div>
        ) : null}
        {beat === 1 ? (
          <motion.div
            key="inversion"
            className="col-start-1 row-start-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: EASE }}
          >
            <BeatInversion step={step} />
          </motion.div>
        ) : null}
        {beat === 2 ? (
          <motion.div
            key="convergence"
            className="col-start-1 row-start-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: EASE }}
          >
            <BeatConvergence step={step} />
          </motion.div>
        ) : null}
        {beat === 3 || beat === 4 ? (
          <motion.div
            key="score"
            className="col-start-1 row-start-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: EASE }}
          >
            <BeatScore showPenalty={beat === 4} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/**
 * Lobby explainer for Wrong Answers Only — ambient loop teaching setup,
 * inversion, concurrence, scoring upside, and zero rule.
 */
export function WaoLobbyExplainer() {
  const reduceMotion = useReducedMotion();

  return (
    <section
      className="rounded-lg border border-unmute-navy/10 bg-unmute-navy/[0.05] p-6 sm:p-7"
      aria-label="Protocol explainer"
    >
      <p className="mb-5 text-center font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
        How it works
      </p>
      {reduceMotion ? <StaticPanels /> : <AnimatedLoop />}
    </section>
  );
}
