"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { TrainOrder } from "./TrainOrder";

const EASE = [0.4, 0, 0.2, 1] as const;
const PANE_MS = 7000;
const WORD_MS = 1800;
const PANE_COUNT = 4;

const GUESSER = { id: "alex", displayName: "Alex" };
const TRAIN = [
  { id: "maya", displayName: "Maya" },
  { id: "jordan", displayName: "Jordan" },
  { id: "sam", displayName: "Sam" },
] as const;

const SENTENCE = [
  { id: "the", label: "The", picture: "the" },
  { id: "unmatched", label: "unmatched", picture: "unmatched" },
  { id: "laundry", label: "laundry", picture: "laundry" },
] as const;

type PictureKind = (typeof SENTENCE)[number]["picture"];

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="rounded-lg border border-unmute-navy/10 bg-unmute-navy/[0.05] p-6 sm:p-7"
      aria-label="How Talk Track works"
    >
      <p className="mb-5 text-center font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
        How it works
      </p>
      {children}
    </section>
  );
}

function PictureCard({
  kind,
  label,
  visible,
}: {
  kind: PictureKind;
  label: string;
  visible: boolean;
}) {
  return (
    <div
      className={`flex h-[4.75rem] flex-col items-center justify-center rounded-md border bg-warm-white px-1 transition-opacity duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
        visible ? "border-unmute-navy/20 opacity-100" : "border-cloud-grey opacity-25"
      }`}
    >
      <div className="flex h-8 w-full items-center justify-center text-unmute-navy" aria-hidden="true">
        {kind === "the" ? <TheMark /> : null}
        {kind === "unmatched" ? <UnmatchedMark /> : null}
        {kind === "laundry" ? <LaundryMark /> : null}
      </div>
      <p className="mt-1 font-display text-[11px] font-semibold text-unmute-navy">{label}</p>
    </div>
  );
}

function TheMark() {
  return (
    <svg viewBox="0 0 40 32" className="h-8 w-8" fill="none" aria-hidden="true">
      <path
        d="M10 20h20"
        className="stroke-unmute-navy"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M14 14h12"
        className="stroke-unmute-navy/45"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UnmatchedMark() {
  return (
    <svg viewBox="0 0 40 32" className="h-8 w-8" fill="none" aria-hidden="true">
      <path
        d="M8 24c0-6 3-10 6-12V8c0-2 1.5-3.5 4-3.5S22 6 22 8v4"
        className="stroke-unmute-navy"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M18 12v12c0 2-1.5 4-4 4s-4-2-4-4"
        className="stroke-unmute-navy"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M24 16c2-1 6 0 7 3"
        className="stroke-unmute-navy/40"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="2 2"
      />
    </svg>
  );
}

function LaundryMark() {
  return (
    <svg viewBox="0 0 40 32" className="h-8 w-8" fill="none" aria-hidden="true">
      <rect
        x="8"
        y="4"
        width="24"
        height="24"
        rx="3"
        className="stroke-unmute-navy"
        strokeWidth="1.75"
      />
      <circle cx="20" cy="18" r="6" className="stroke-unmute-navy" strokeWidth="1.75" />
      <circle cx="14" cy="9" r="1.25" className="fill-unmute-navy" />
      <circle cx="18" cy="9" r="1.25" className="fill-unmute-navy" />
    </svg>
  );
}

function ClueCard() {
  return (
    <div className="rounded-md border border-unmute-navy/20 bg-warm-white p-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
        Clue card
      </p>
      <p className="mt-1 font-display text-lg font-bold text-unmute-navy">SOCK</p>
      <p className="mt-1 font-body text-xs leading-relaxed text-slate">
        Only you and the rest of your team can see this. The guesser cannot.
      </p>
    </div>
  );
}

function RolesPane() {
  return (
    <div className="flex h-full flex-col">
      <p className="font-body text-sm leading-relaxed text-charcoal">
        Each round, one teammate is the guesser. The other three are the Clue
        Train, in order. The guesser and that order change every round.
      </p>
      <div className="mt-4 grid min-h-0 flex-1 grid-cols-2 gap-3">
        <div className="flex flex-col justify-center">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-steel-blue">
            Guesser
          </p>
          <div className="rounded-md border border-unmute-navy bg-warm-white px-3 py-4 text-center">
            <p className="font-display text-lg font-semibold text-unmute-navy">
              {GUESSER.displayName}
            </p>
            <p className="mt-1 font-body text-xs text-slate">Cannot see the card</p>
          </div>
        </div>
        <div className="min-h-0 overflow-hidden">
          <TrainOrder members={[...TRAIN]} caption="Clue Train" />
        </div>
      </div>
      <p className="mt-4 font-body text-sm leading-relaxed text-charcoal">
        If it is not your team&apos;s turn, watch. Do not clue. Do not react.
      </p>
    </div>
  );
}

function GoalPane({ wordStep }: { wordStep: number }) {
  const active = TRAIN[wordStep % TRAIN.length];
  return (
    <div className="flex h-full flex-col">
      <p className="font-body text-sm leading-relaxed text-charcoal">
        The Clue Train builds a grammatically correct sentence, one word at a
        time, so the guesser can name the word on the card.
      </p>
      <div className="mt-3 grid min-h-0 flex-1 grid-cols-2 gap-3">
        <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
          <ClueCard />
          <TrainOrder
            members={[...TRAIN]}
            activeId={active?.id ?? null}
            caption="Clue Train"
          />
        </div>
        <div className="flex min-h-0 flex-col justify-center gap-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
            The sentence
          </p>
          {SENTENCE.map((word, index) => (
            <PictureCard
              key={word.id}
              kind={word.picture}
              label={word.label}
              visible={index <= wordStep}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StopPane() {
  return (
    <div className="flex h-full flex-col justify-between gap-3">
      <p className="font-body text-sm leading-relaxed text-charcoal">
        Once the Clue Train has finished the clue, the next player hits Stop so
        the guesser can guess.
      </p>
      <div className="flex justify-center">
        <span className="rounded-md bg-signal-amber px-6 py-3 font-display text-base font-semibold text-deep-navy">
          Stop
        </span>
      </div>
      <p className="font-body text-sm leading-relaxed text-charcoal">
        After Stop, the Clue Train is silent. No extra words. No coaching. No
        faces that give it away.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md bg-signal-amber px-3 py-3 text-center font-display text-sm font-semibold text-deep-navy">
          Got it
        </div>
        <div className="rounded-md border border-cloud-grey px-3 py-3 text-center font-display text-sm font-semibold text-unmute-navy">
          Pass
        </div>
      </div>
      <p className="font-body text-sm leading-relaxed text-charcoal">
        They get it, or you pass and start a new sentence on the next word. One
        minute for the whole card.
      </p>
    </div>
  );
}

function RuleRow({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className="flex items-start gap-2">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[11px] ${
          ok ? "bg-unmute-navy text-warm-white" : "bg-signal-red text-warm-white"
        }`}
        aria-hidden="true"
      >
        {ok ? "✓" : "×"}
      </span>
      <span className="font-body text-sm text-charcoal">{text}</span>
    </li>
  );
}

function RulesPane() {
  return (
    <div className="flex h-full flex-col">
      <p className="font-body text-sm leading-relaxed text-charcoal">
        Each person on the Clue Train adds exactly one English word. Your team
        must form a proper coherent sentence. Do not say the word on the card.
      </p>
      <div className="mt-4 grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-unmute-navy/15 bg-warm-white p-4">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-unmute-navy">
            Your clue can
          </p>
          <ul className="flex flex-col gap-2">
            <RuleRow ok text="Say one word only, or if the clue is complete, hit Stop" />
            <RuleRow ok text="Use proper nouns if they are not the target word" />
            <RuleRow ok text="Small words (the, an, of, etc.) all count as your turn on the Clue Train" />
          </ul>
        </div>
        <div className="rounded-md border border-signal-red/30 bg-warm-white p-4">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-signal-red">
            Your clue cannot
          </p>
          <ul className="flex flex-col gap-2">
            <RuleRow ok={false} text="Say the word, or a form of it" />
            <RuleRow ok={false} text="Spell, rhyme, or say “starts with”" />
            <RuleRow ok={false} text="Use a foreign word for the target" />
            <RuleRow ok={false} text="Gesture, or break the sentence" />
          </ul>
        </div>
      </div>
    </div>
  );
}

function PaneDots({ current }: { current: number }) {
  return (
    <div className="mt-4 flex justify-center gap-2" aria-hidden="true">
      {Array.from({ length: PANE_COUNT }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${
            i === current ? "bg-unmute-navy" : "bg-cloud-grey"
          }`}
        />
      ))}
    </div>
  );
}

function Stage({ pane, wordStep }: { pane: number; wordStep: number }) {
  return (
    <div className="h-full">
      {pane === 0 ? <RolesPane /> : null}
      {pane === 1 ? <GoalPane wordStep={wordStep} /> : null}
      {pane === 2 ? <StopPane /> : null}
      {pane === 3 ? <RulesPane /> : null}
    </div>
  );
}

export function TalkTrackLobbyExplainer() {
  const reduceMotion = useReducedMotion();
  const [pane, setPane] = useState(0);
  const [wordStep, setWordStep] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => {
      setPane((p) => (p + 1) % PANE_COUNT);
      setWordStep(0);
    }, PANE_MS);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion || pane !== 1) return;
    const id = window.setInterval(() => {
      setWordStep((s) => (s + 1) % SENTENCE.length);
    }, WORD_MS);
    return () => window.clearInterval(id);
  }, [reduceMotion, pane]);

  if (reduceMotion) {
    return (
      <Shell>
        <div className="space-y-10">
          <RolesPane />
          <GoalPane wordStep={SENTENCE.length - 1} />
          <StopPane />
          <RulesPane />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="relative h-[28rem] overflow-hidden sm:h-[30rem]">
        <AnimatePresence initial={false}>
          <motion.div
            key={pane}
            className="absolute inset-0"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <Stage pane={pane} wordStep={wordStep} />
          </motion.div>
        </AnimatePresence>
      </div>
      <PaneDots current={pane} />
    </Shell>
  );
}
