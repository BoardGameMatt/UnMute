"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { LobbyExplainerDots } from "@/components/ui/LobbyExplainerDots";

const EASE = [0.4, 0, 0.2, 1] as const;
const PANE_MS = 7500;

type SampleItem = {
  name: string;
  clue: string;
  number: number;
};

const SAMPLE: SampleItem[] = [
  { name: "Maya", clue: "Plastic crab cracker", number: 8 },
  { name: "Priya", clue: "Whisk from IKEA", number: 48 },
  { name: "Jordan", clue: "Twisting garlic press", number: 72 },
  { name: "Sam", clue: "Parmesan grater like Olive Garden’s", number: 92 },
];

const SCRAMBLED = [SAMPLE[2], SAMPLE[0], SAMPLE[3], SAMPLE[1]] as const;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="rounded-lg border border-unmute-navy/10 bg-unmute-navy/[0.05] p-6 sm:p-7"
      aria-label="How Rank and File works"
    >
      <p className="mb-5 text-center font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
        How it works
      </p>
      {children}
    </section>
  );
}

function BeatCaption({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 text-center font-body text-sm leading-relaxed text-charcoal">{children}</p>
  );
}

function MiniCard({
  clue,
  name,
  number,
}: {
  clue: string;
  name: string;
  number?: number;
}) {
  return (
    <div className="rounded-md border border-unmute-navy/20 bg-warm-white px-2 py-2">
      <p className="font-body text-[11px] leading-snug text-charcoal">{clue}</p>
      <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-steel-blue">
        {name}
        {number !== undefined ? ` · ${number}` : ""}
      </p>
    </div>
  );
}

function DeviceBeat() {
  return (
    <svg
      viewBox="0 0 240 150"
      fill="none"
      className="mx-auto h-[9.5rem] w-full max-w-[240px]"
      aria-hidden="true"
    >
      <rect x="30" y="22" width="150" height="94" rx="6" className="fill-unmute-navy" />
      <rect x="38" y="30" width="134" height="78" rx="3" className="fill-warm-white" />
      <rect x="150" y="52" width="62" height="98" rx="9" className="fill-deep-navy" />
      <rect x="155" y="60" width="52" height="84" rx="4" className="fill-warm-white" />
      <rect x="160" y="80" width="42" height="10" rx="2" className="fill-signal-amber" />
    </svg>
  );
}

function SecretNumberBeat() {
  return (
    <div className="mx-auto w-full max-w-[16rem] space-y-3">
      <p className="text-center font-display text-sm font-semibold text-unmute-navy">
        Kitchen gadgets
      </p>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-lg text-unmute-navy">0</p>
          <p className="font-body text-[11px] text-slate">Pointless</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-lg text-unmute-navy">100</p>
          <p className="font-body text-[11px] text-slate">Couldn&apos;t cook without it</p>
        </div>
      </div>
      <div className="rounded-lg border border-unmute-navy/20 bg-warm-white px-3 py-3 text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
          Your number
        </p>
        <p className="mt-1 font-display text-3xl font-bold text-unmute-navy">?</p>
        <p className="mt-2 font-body text-xs text-slate">Keep it on this phone.</p>
      </div>
    </div>
  );
}

function WritingBeat() {
  return (
    <div className="mx-auto w-full max-w-[16rem] space-y-3">
      <div className="rounded-lg border border-unmute-navy/20 bg-warm-white px-3 py-3 text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
          Your number
        </p>
        <p className="mt-1 font-display text-4xl font-bold text-unmute-navy">48</p>
      </div>
      <div className="rounded-md border-2 border-unmute-navy border-l-4 bg-warm-white px-3 py-2 text-left">
        <p className="font-body text-sm text-charcoal">Whisk from IKEA</p>
        <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-steel-blue">Priya</p>
      </div>
    </div>
  );
}

function ScrambleBeat() {
  const ranked = [SCRAMBLED[0], SCRAMBLED[1]] as const;
  const unranked = [SCRAMBLED[2], SCRAMBLED[3]] as const;
  return (
    <div className="mx-auto grid w-full max-w-[20rem] grid-cols-2 gap-3">
      <div>
        <p className="font-mono text-sm text-unmute-navy">0</p>
        <p className="mb-2 font-body text-[10px] text-slate">Pointless</p>
        <div className="space-y-2">
          {ranked.map((item) => (
            <MiniCard key={item.clue} clue={item.clue} name={item.name} />
          ))}
        </div>
        <p className="mt-2 font-mono text-sm text-unmute-navy">100</p>
        <p className="font-body text-[10px] text-slate">Couldn&apos;t cook without it</p>
      </div>
      <div className="space-y-2 rounded-md border border-cloud-grey bg-warm-white p-2">
        <p className="font-mono text-[9px] uppercase tracking-widest text-steel-blue">
          Unranked
        </p>
        {unranked.map((item) => (
          <MiniCard key={item.clue} clue={item.clue} name={item.name} />
        ))}
      </div>
    </div>
  );
}

function TruthBeat() {
  return (
    <div className="mx-auto w-full max-w-[16rem] space-y-2">
      <p className="font-mono text-sm text-unmute-navy">0</p>
      <p className="font-body text-[10px] text-slate">Pointless</p>
      {SAMPLE.map((item) => (
        <MiniCard key={item.clue} clue={item.clue} name={item.name} number={item.number} />
      ))}
      <p className="font-mono text-sm text-unmute-navy">100</p>
      <p className="font-body text-[10px] text-slate">Couldn&apos;t cook without it</p>
    </div>
  );
}

const PANES = [
  {
    caption:
      "To join, scan the QR with your phone. Play on your phone. Leave the laptop on the shared screen so nobody sees your number.",
    body: <DeviceBeat />,
  },
  {
    caption:
      "Each of you gets a secret number. Write a clue for where that number sits on the scale. Keep the number to yourself.",
    body: <SecretNumberBeat />,
  },
  {
    caption:
      "Your phone shows the number and the clue you are writing. Qualifiers and adjectives are fair game. No counts, numbers, or measures.",
    body: <WritingBeat />,
  },
  {
    caption:
      "Then the team ranks the examples from 0 to 100 — not yet in the right order. Everyone talks. The facilitator moves the cards.",
    body: <ScrambleBeat />,
  },
  {
    caption: "Exact order scores. The truth row shows each name and its number.",
    body: <TruthBeat />,
  },
] as const;

function PaneBody({ index }: { index: number }) {
  const pane = PANES[index] ?? PANES[0];
  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-[16rem] flex-1 items-center justify-center">{pane.body}</div>
      <BeatCaption>{pane.caption}</BeatCaption>
    </div>
  );
}

export function RankAndFileLobbyExplainer() {
  const reduce = useReducedMotion();
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setBeat((n) => (n + 1) % PANES.length);
    }, PANE_MS);
    return () => window.clearInterval(id);
  }, [reduce]);

  if (reduce) {
    return (
      <Shell>
        <div className="space-y-8">
          {PANES.map((pane, i) => (
            <div key={pane.caption}>
              <PaneBody index={i} />
            </div>
          ))}
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="relative">
        <div className="invisible" aria-hidden="true">
          <PaneBody index={4} />
        </div>
        <motion.div
          key={beat}
          className="absolute inset-0"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
        >
          <PaneBody index={beat} />
        </motion.div>
      </div>
      <LobbyExplainerDots count={PANES.length} current={beat} />
    </Shell>
  );
}
