"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { LobbyExplainerDots } from "@/components/ui/LobbyExplainerDots";

const EASE = [0.4, 0, 0.2, 1] as const;
const PANE_MS = 6000;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="rounded-lg border border-unmute-navy/10 bg-unmute-navy/[0.05] p-6 sm:p-7"
      aria-label="How SwitchCode works"
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

function WriteBeat() {
  return (
    <div className="mx-auto w-full max-w-[16rem] space-y-2">
      <p className="text-center font-mono text-[10px] uppercase tracking-widest text-steel-blue">
        Guessing · Alex
      </p>
      <div className="rounded-md border border-unmute-navy/20 bg-warm-white px-3 py-2 font-body text-sm text-slate">
        One word
      </div>
      <div className="flex justify-center gap-1">
        {["Maya", "Jordan", "Steve"].map((name) => (
          <span
            key={name}
            className="rounded-full border border-cloud-grey bg-warm-white px-2 py-1 font-body text-[11px] text-charcoal"
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

function AssembleDisperseBeat() {
  return (
    <div className="mx-auto grid w-full max-w-[18rem] grid-cols-2 gap-2">
      <div className="rounded-lg border border-cloud-grey bg-warm-white p-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-unmute-navy">Assemble</p>
        <p className="mt-2 font-body text-xs leading-relaxed text-charcoal">
          Duplicated clues reach the guesser
        </p>
      </div>
      <div className="rounded-lg border border-cloud-grey bg-warm-white p-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-unmute-navy">Disperse</p>
        <p className="mt-2 font-body text-xs leading-relaxed text-charcoal">
          Unique clues reach the guesser
        </p>
      </div>
    </div>
  );
}

function OneGuessBeat() {
  return (
    <div className="mx-auto w-full max-w-[16rem] space-y-2 text-center">
      <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">Guesser</p>
      <div className="rounded-md border border-unmute-navy/20 bg-warm-white px-3 py-2 font-body text-sm text-slate">
        One guess
      </div>
      <p className="font-body text-xs text-slate">Clue givers stay silent</p>
    </div>
  );
}

function ScoreBeat() {
  return (
    <div className="mx-auto w-full max-w-[14rem] text-center">
      <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">Team score</p>
      <p className="font-display text-3xl font-bold text-unmute-navy">—</p>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-steel-blue">
        Shown the most
      </p>
      <p className="mt-1 font-body text-sm text-charcoal">Maya</p>
    </div>
  );
}

const PANES = [
  {
    caption:
      "To join, scan the QR with your phone. Play on your phone. Leave the laptop on the shared screen so nobody sees your clue.",
    body: <DeviceBeat />,
  },
  {
    caption:
      "One player is chosen randomly as the Guesser. Every other player will provide a single word clue to help the guesser figure out the secret word. Clue givers cannot collaborate and must provide their clue independently.",
    body: <WriteBeat />,
  },
  {
    caption:
      "The catch is that only some of the clues will be shown to the guesser. On Assemble rounds, only duplicated clues are shown to the guesser. On Disperse rounds, only unique clues are shown to the guesser.",
    body: <AssembleDisperseBeat />,
  },
  {
    caption:
      "The guesser does not know what kind of round it is. They only get one guess. All clue givers must stay silent.",
    body: <OneGuessBeat />,
  },
  {
    caption:
      "The whole team scores when the guesser figures out the secret word. When the game is over, you will see which members of the team got their clues through the most.",
    body: <ScoreBeat />,
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

export function CodeSwitchLobbyExplainer() {
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
          <PaneBody index={1} />
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
