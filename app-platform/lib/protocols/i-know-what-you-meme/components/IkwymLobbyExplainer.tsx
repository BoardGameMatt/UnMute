"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

const EASE = [0.4, 0, 0.2, 1] as const;
const PANE_MS = 5000;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="rounded-lg border border-unmute-navy/10 bg-unmute-navy/[0.05] p-6 sm:p-7"
      aria-label="How I Know What You Meme works"
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

function DeviceIllustration() {
  return (
    <svg
      viewBox="0 0 240 150"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="mx-auto h-[9.5rem] w-full max-w-[240px]"
      aria-hidden="true"
    >
      <rect x="30" y="22" width="150" height="94" rx="6" className="fill-unmute-navy" />
      <rect x="38" y="30" width="134" height="78" rx="3" className="fill-warm-white" />
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
      <rect x="150" y="52" width="62" height="98" rx="9" className="fill-deep-navy" />
      <rect x="155" y="60" width="52" height="84" rx="4" className="fill-warm-white" />
      <g className="fill-unmute-navy" opacity="0.14">
        <rect x="160" y="66" width="42" height="10" rx="2" />
        <rect x="160" y="94" width="42" height="10" rx="2" />
        <rect x="160" y="122" width="42" height="10" rx="2" />
      </g>
      <g className="fill-signal-amber">
        <rect x="160" y="80" width="42" height="10" rx="2" />
      </g>
    </svg>
  );
}

function SamplePromptsAndGrid() {
  return (
    <div className="mx-auto w-full max-w-[16rem]">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-cloud-grey bg-warm-white p-3">
          <p className="font-mono text-[8px] uppercase tracking-widest text-steel-blue">Check-in</p>
          <p className="mt-1 font-display text-[11px] font-semibold leading-snug text-unmute-navy">
            If this meeting were a sandwich, what would it be?
          </p>
        </div>
        <div className="rounded-lg border border-cloud-grey bg-warm-white p-3">
          <p className="font-mono text-[8px] uppercase tracking-widest text-steel-blue">Stimulus</p>
          <p className="mt-1 font-display text-[11px] font-semibold leading-snug text-unmute-navy">
            Name a kitchen appliance.
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {Array.from({ length: 9 }, (_, i) => (
          <div
            key={i}
            className={`flex aspect-square items-center justify-center rounded-md border-2 ${
              i === 4 ? "border-signal-amber bg-warm-white" : "border-cloud-grey bg-warm-white"
            }`}
          >
            {i === 4 ? <ToasterStill /> : <span className="h-4 w-4 rounded-sm bg-cloud-grey" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function ToasterStill() {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
      <rect x="6" y="12" width="20" height="12" rx="2" className="fill-unmute-navy" />
      <rect x="9" y="8" width="5" height="6" rx="1" className="fill-unmute-navy/70" />
      <rect x="18" y="8" width="5" height="6" rx="1" className="fill-unmute-navy/70" />
      <circle cx="22" cy="18" r="1.4" className="fill-warm-white" />
    </svg>
  );
}

function ClosedMouthChips() {
  const names = ["Maya", "Jordan", "Steve"];
  return (
    <ul className="mx-auto flex w-full max-w-[14rem] flex-col gap-2">
      {names.map((name) => (
        <li
          key={name}
          className="flex items-center justify-between rounded-lg border border-cloud-grey bg-warm-white px-4 py-2"
        >
          <span className="font-display text-base font-semibold text-unmute-navy">{name}</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
            —
          </span>
        </li>
      ))}
    </ul>
  );
}

function GuessBeat() {
  return (
    <div className="mx-auto w-full max-w-[16rem]">
      <div className="flex h-20 items-center justify-center rounded-lg border border-cloud-grey bg-warm-white">
        <ToasterStill />
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {["Maya", "Jordan", "Steve"].map((name, i) => (
          <li
            key={name}
            className={`rounded-md px-3 py-2 font-display text-sm font-semibold text-unmute-navy ${
              i === 1
                ? "border-2 border-unmute-navy bg-warm-white"
                : "border border-unmute-navy/20 bg-warm-white"
            }`}
          >
            {name}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SitOutBeat() {
  return (
    <div className="mx-auto w-full max-w-[16rem] space-y-3">
      <ul className="flex flex-col gap-1.5">
        {["Maya", "Jordan", "Steve"].map((name, i) => (
          <li
            key={name}
            className={`rounded-md px-3 py-2 font-display text-sm font-semibold ${
              i === 0
                ? "border border-cloud-grey bg-cloud-grey text-slate"
                : "border border-unmute-navy/20 bg-warm-white text-unmute-navy"
            }`}
          >
            {name}
            {i === 0 ? " · sitting out" : ""}
          </li>
        ))}
      </ul>
      <p className="rounded-md border border-cloud-grey bg-warm-white px-3 py-2 text-center font-body text-[11px] leading-relaxed text-charcoal">
        Pick something you’d show this team.
      </p>
    </div>
  );
}

const PANES = [
  {
    caption: "Play on your phone. Keep everyone's video up on your laptop.",
    body: <DeviceIllustration />,
  },
  {
    caption: "Same two prompts for everyone. Search. Pick one GIF.",
    body: <SamplePromptsAndGrid />,
  },
  {
    caption: "Don’t say which one is yours.",
    body: <ClosedMouthChips />,
  },
  {
    caption: "Then we guess who picked it. Reading them is the score.",
    body: <GuessBeat />,
  },
  {
    caption:
      "The person who picked it sits this one out. Guessing yourself doesn’t count. Pick something you’d show this team.",
    body: <SitOutBeat />,
  },
] as const;

function PaneBody({ index }: { index: number }) {
  const pane = PANES[index] ?? PANES[0];
  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-[12.5rem] flex-1 items-center justify-center">{pane.body}</div>
      <BeatCaption>{pane.caption}</BeatCaption>
    </div>
  );
}

function PaneDots({ current }: { current: number }) {
  return (
    <div className="mt-4 flex justify-center gap-2" aria-hidden="true">
      {PANES.map((pane, i) => (
        <span
          key={pane.caption}
          className={`h-1.5 w-1.5 rounded-full ${
            i === current ? "bg-unmute-navy" : "bg-cloud-grey"
          }`}
        />
      ))}
    </div>
  );
}

export function IkwymLobbyExplainer() {
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
      <PaneDots current={beat} />
    </Shell>
  );
}
