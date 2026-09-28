"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { LobbyExplainerDots } from "@/components/ui/LobbyExplainerDots";

const EASE = [0.4, 0, 0.2, 1] as const;
const BEAT_MS = 4000;

const SAMPLE = "I once named a houseplant Kevin.";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="rounded-lg border border-unmute-navy/10 bg-unmute-navy/[0.05] p-6 sm:p-7"
      aria-label="How The Truth Is works"
    >
      <p className="mb-5 text-center font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
        How it works
      </p>
      {children}
    </section>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 text-center font-body text-sm leading-relaxed text-charcoal">{children}</p>
  );
}

function DeviceBeat() {
  return (
    <svg
      viewBox="0 0 240 120"
      className="mx-auto h-28 w-full max-w-[240px]"
      aria-hidden="true"
    >
      <rect x="28" y="18" width="140" height="84" rx="6" className="fill-unmute-navy" />
      <rect x="36" y="26" width="124" height="68" rx="3" className="fill-warm-white" />
      <rect x="44" y="34" width="28" height="22" rx="2" className="fill-cloud-grey" />
      <rect x="78" y="34" width="28" height="22" rx="2" className="fill-cloud-grey" />
      <rect x="112" y="34" width="28" height="22" rx="2" className="fill-cloud-grey" />
      <rect x="158" y="36" width="52" height="78" rx="8" className="fill-deep-navy" />
      <rect x="163" y="42" width="42" height="60" rx="3" className="fill-warm-white" />
      <rect x="170" y="58" width="28" height="8" rx="2" className="fill-signal-amber" />
    </svg>
  );
}

function WriteBeat() {
  return (
    <div className="mx-auto w-full max-w-xs space-y-2">
      <div className="rounded-md border border-cloud-grey bg-warm-white px-3 py-3">
        <p className="font-body text-xs text-slate">The truth is...</p>
        <p className="mt-1 font-body text-sm text-charcoal">{SAMPLE}</p>
      </div>
      <div className="rounded-md border border-cloud-grey bg-warm-white px-3 py-3">
        <p className="font-body text-xs text-slate">
          ...something even <span className="font-bold text-charcoal">MORE</span> surprising.
        </p>
      </div>
    </div>
  );
}

function ReadBeat() {
  return (
    <div className="mx-auto w-full max-w-xs rounded-md border border-cloud-grey bg-warm-white px-4 py-4 text-center">
      <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">Maya reads</p>
      <p className="mt-2 font-display text-lg font-semibold text-unmute-navy">{SAMPLE}</p>
    </div>
  );
}

function GuessBeat() {
  return (
    <div className="mx-auto grid w-full max-w-xs grid-cols-1 gap-2">
      {["Maya", "Jordan", "Sam"].map((name) => (
        <div
          key={name}
          className={`rounded-md bg-warm-white px-3 py-2 font-body text-sm text-charcoal ${
            name === "Jordan" ? "border-2 border-unmute-navy font-semibold" : "border border-cloud-grey"
          }`}
        >
          {name}
        </div>
      ))}
    </div>
  );
}

function ScoreBeat() {
  return (
    <div className="mx-auto w-full max-w-xs rounded-md border border-cloud-grey bg-warm-white px-4 py-4 text-center">
      <p className="font-body text-sm text-charcoal">{SAMPLE}</p>
      <p className="mt-3 font-display text-base font-semibold text-unmute-navy">
        Maya <span className="font-mono">+1</span>
      </p>
    </div>
  );
}

const BEATS = [
  {
    caption: "Play on your phone. Keep everyone's video up on your laptop.",
    body: <DeviceBeat />,
  },
  {
    caption: "Write two truths. The second one goes further.",
    body: <WriteBeat />,
  },
  {
    caption: "Someone reads one aloud. Don't say if it's yours.",
    body: <ReadBeat />,
  },
  {
    caption: "Guess who wrote it, on your phone.",
    body: <GuessBeat />,
  },
  {
    caption: "A correct guess scores. If you read your own and nobody catches you, you score.",
    body: <ScoreBeat />,
  },
];

function BeatBody({ index }: { index: number }) {
  const beat = BEATS[index] ?? BEATS[0];
  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-[9rem] flex-1 items-center justify-center">{beat.body}</div>
      <Caption>{beat.caption}</Caption>
    </div>
  );
}

export function TruthIsLobbyExplainer() {
  const reduce = useReducedMotion();
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setBeat((n) => (n + 1) % BEATS.length);
    }, BEAT_MS);
    return () => window.clearInterval(id);
  }, [reduce]);

  if (reduce) {
    return (
      <Shell>
        <div className="space-y-8">
          {BEATS.map((item) => (
            <div key={item.caption}>
              <div className="flex min-h-[9rem] items-center justify-center">{item.body}</div>
              <Caption>{item.caption}</Caption>
            </div>
          ))}
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="grid">
        {BEATS.map((item, index) => (
          <motion.div
            key={item.caption}
            className={`col-start-1 row-start-1 ${index === beat ? "" : "invisible"}`}
            initial={false}
            animate={{ opacity: index === beat ? 1 : 0, y: index === beat ? 0 : 4 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <BeatBody index={index} />
          </motion.div>
        ))}
      </div>
      <LobbyExplainerDots count={BEATS.length} current={beat} />
    </Shell>
  );
}
