"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

const EASE = [0.4, 0, 0.2, 1] as const;
const PANE_MS = 5000;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="rounded-lg border border-unmute-navy/10 bg-unmute-navy/[0.05] p-6 sm:p-7"
      aria-label="Protocol explainer"
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

/** Mid-game city: some lots occupied, some still empty. Fake names only. */
function MidGameBoard() {
  const cells: Array<{ kind: "hall" | "building" | "lot" | "empty"; label?: string }> = Array.from(
    { length: 35 },
    () => ({ kind: "empty" })
  );
  const set = (col: number, row: number, cell: (typeof cells)[number]) => {
    cells[row * 5 + col] = cell;
  };
  set(2, 3, { kind: "hall" });
  set(2, 2, { kind: "building", label: "PIER" });
  set(3, 3, { kind: "building", label: "FERRY" });
  set(2, 4, { kind: "building", label: "MILL" });
  set(1, 3, { kind: "building", label: "DOCK" });
  set(2, 1, { kind: "building", label: "INN" });
  set(4, 3, { kind: "building", label: "YARD" });
  set(1, 2, { kind: "lot", label: "A" });
  set(3, 2, { kind: "lot", label: "B" });
  set(2, 5, { kind: "lot", label: "C" });

  return (
    <div className="mx-auto w-full max-w-[14rem]">
      <div className="grid grid-cols-5 gap-0.5">
        {cells.map((cell, i) => (
          <div
            key={i}
            className={`flex aspect-square items-center justify-center rounded-[2px] text-center font-display leading-none ${
              cell.kind === "hall"
                ? "bg-unmute-navy text-[6px] font-medium uppercase tracking-wide text-warm-white"
                : cell.kind === "building"
                  ? "border border-unmute-navy/40 bg-warm-white text-[6px] font-semibold text-unmute-navy"
                  : cell.kind === "lot"
                    ? "border-2 border-dashed border-unmute-navy bg-warm-white text-[9px] font-semibold text-unmute-navy"
                    : "border border-cloud-grey bg-warm-white"
            }`}
          >
            {cell.kind === "hall" ? (
              <span>
                City
                <br />
                Hall
              </span>
            ) : (
              cell.label
            )}
          </div>
        ))}
      </div>
      <p className="mt-2 text-center font-mono text-[9px] uppercase tracking-widest text-steel-blue">
        How would they zone A, B, C?
      </p>
    </div>
  );
}

function HowItRuns() {
  const steps = [
    "A Zoning Manager is chosen.",
    "The City Planner picks which squares to develop.",
    "The Zoning Manager chooses which buildings go on those squares.",
    "Everyone else guesses that placement in secret on their phones.",
  ];
  return (
    <ol className="mx-auto w-full max-w-sm space-y-2 text-left">
      {steps.map((step, i) => (
        <li key={step} className="flex gap-2 font-body text-sm text-charcoal">
          <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
            {i + 1}.
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}

function ExactMatchRoster() {
  const names = ["Maya", "Jordan", "Steve"];
  return (
    <ul className="mx-auto flex w-full max-w-[14rem] flex-col gap-2">
      {names.map((name) => (
        <li
          key={name}
          className="flex items-center justify-between rounded-lg border border-cloud-grey bg-warm-white px-4 py-2"
        >
          <span className="font-display text-base font-semibold text-unmute-navy">{name}</span>
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full bg-sunrise-gold font-display text-sm font-bold text-deep-navy"
            aria-label="Exact match"
          >
            ✓
          </span>
        </li>
      ))}
    </ul>
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
        <rect x="160" y="108" width="42" height="10" rx="2" />
      </g>
    </svg>
  );
}

const PANES = [
  {
    caption: "Play on your phone. Keep the facilitator’s video open on your laptop.",
    body: <DeviceIllustration />,
  },
  {
    caption:
      "The Zoning Manager zones the lots however they think is best for the city. Everyone else guesses that placement in secret — then you find out who read them right.",
    body: <MidGameBoard />,
  },
  {
    caption: "Here’s the order of a round.",
    body: <HowItRuns />,
  },
  {
    caption:
      "After the Zoning Manager has made a decision, they turn off their camera and go on mute while the other players decide.",
    body: (
      <div className="flex h-[9.5rem] items-center justify-center">
        <p className="text-center font-display text-lg font-semibold text-unmute-navy">
          Camera off. Mute yourself.
        </p>
      </div>
    ),
  },
  {
    caption: "It’s all or nothing. Match every lot and you score. One wrong, and you don’t.",
    body: <ExactMatchRoster />,
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

export function ZoningRightsLobbyExplainer() {
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
      <PaneDots current={beat} />
    </Shell>
  );
}
