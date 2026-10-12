"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { LobbyExplainerDots } from "@/components/ui/LobbyExplainerDots";
import { iconCreditLine } from "../icon-credits";
import { AirtimeAirGauge } from "./AirtimeAirGauge";
import { BoatmateChip, EASE } from "./AirtimeChrome";
import { AirtimeItemCard } from "./AirtimeItemCard";

const PANE_MS = 10000;

function DeviceBeat() {
  return (
    <svg viewBox="0 0 240 150" fill="none" className="mx-auto h-[9.5rem] w-full max-w-[240px]" aria-hidden="true">
      <rect x="20" y="18" width="160" height="100" rx="6" className="fill-unmute-navy" />
      <rect x="28" y="26" width="144" height="84" rx="3" className="fill-warm-white" />
      {[0, 1, 2].map((col) =>
        [0, 1].map((row) => (
          <rect
            key={`${col}-${row}`}
            x={34 + col * 46}
            y={32 + row * 38}
            width="40"
            height="32"
            rx="3"
            className="fill-steel-blue/30"
          />
        ))
      )}
      <rect x="168" y="56" width="56" height="92" rx="9" className="fill-deep-navy" />
      <rect x="173" y="64" width="46" height="78" rx="4" className="fill-warm-white" />
      <rect x="178" y="112" width="36" height="9" rx="2" className="fill-unmute-navy" />
      <rect x="178" y="125" width="36" height="9" rx="2" className="fill-cloud-grey" />
    </svg>
  );
}

const TANK_MASK = "url(/protocols/airtime/tank.svg)";

function TankBeat() {
  return (
    <div className="mx-auto w-full max-w-[17rem] space-y-4">
      <div className="flex items-center gap-4 rounded-lg border border-cloud-grey bg-warm-white p-4">
        <span
          className="block h-12 w-12 shrink-0 bg-unmute-navy"
          style={{
            maskImage: TANK_MASK,
            WebkitMaskImage: TANK_MASK,
            maskSize: "contain",
            WebkitMaskSize: "contain",
            maskRepeat: "no-repeat",
            WebkitMaskRepeat: "no-repeat",
            maskPosition: "center",
            WebkitMaskPosition: "center",
          }}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">Shared oxygen tank</p>
          <div className="mt-2 h-3 w-full rounded-sm bg-cloud-grey">
            <div className="h-3 w-2/3 rounded-sm bg-unmute-navy" />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <BoatmateChip name="Ana" status="underwater" />
        <BoatmateChip name="Ben" status="underwater" />
        <BoatmateChip name="Cy" status="underwater" />
        <BoatmateChip name="Dee" status="underwater" />
      </div>
    </div>
  );
}

function TreasureBeat() {
  return (
    <div className="mx-auto w-full max-w-[16rem] space-y-2">
      <AirtimeItemCard itemId="sample-rubber-duck" name="Rubber duck" level={1} value={null} state="underwater" compact hideValue />
      <AirtimeItemCard itemId="sample-toy-anchor" name="Toy anchor" level={3} value={null} state="underwater" compact hideValue />
      <AirtimeItemCard itemId="sample-plastic-castle" name="Plastic castle" level={5} value={null} state="underwater" compact hideValue />
      <p className="text-center font-mono text-[10px] uppercase tracking-widest text-steel-blue">
        ↓ Deeper, more valuable
      </p>
    </div>
  );
}

function ChoiceBeat() {
  return (
    <div className="mx-auto w-full max-w-[17rem] space-y-3">
      <AirtimeAirGauge label="Low" segments={2} />
      <div className="flex gap-2">
        <span className="flex-1 rounded-md border-2 border-cloud-grey bg-warm-white py-3 text-center font-display text-sm font-semibold text-unmute-navy">
          ↓ Dive Deeper
        </span>
        <span className="flex-1 rounded-md border-2 border-cloud-grey bg-warm-white py-3 text-center font-display text-sm font-semibold text-unmute-navy">
          ↑ Swim back up
        </span>
      </div>
    </div>
  );
}

function LostBeat() {
  return (
    <div className="mx-auto w-full max-w-[16rem]">
      <AirtimeItemCard itemId="sample-plastic-castle" name="Plastic castle" level={5} value={0} state="lost" hideValue />
    </div>
  );
}

const PANES = [
  {
    caption:
      "Play on your phone. Keep the call on your laptop with cameras on. No talking while you're diving, but you can use hand signals.",
    body: <DeviceBeat />,
  },
  {
    caption:
      "You'll be on a boat with up to three others from your team, sharing one oxygen tank for the dive. Everyone underwater uses air every turn, and deeper levels use more.",
    body: <TankBeat />,
  },
  {
    caption:
      "The deeper you dive, the more valuable the treasure you'll find. Once you're back at the surface, you're done for that dive.",
    body: <TreasureBeat />,
  },
  {
    caption:
      "Every turn, choose Dive Deeper or Swim back up. Once you're back in the boat, you'll have full access to the instruments and can talk to the other members of your team.",
    body: <ChoiceBeat />,
  },
  {
    caption:
      "If your boat's air runs out while you're underwater, you lose your treasure from that dive. Highest score wins.",
    body: <LostBeat />,
  },
] as const;

function PaneBody({ index }: { index: number }) {
  const pane = PANES[index] ?? PANES[0];
  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-[13rem] flex-1 items-center justify-center">{pane.body}</div>
      <p className="mt-4 text-center font-body text-sm leading-relaxed text-charcoal">{pane.caption}</p>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="rounded-lg border border-unmute-navy/10 bg-unmute-navy/[0.05] p-6 sm:p-7"
      aria-label="How Airtime works"
    >
      <p className="mb-5 text-center font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
        How it works
      </p>
      {children}
      <p className="mt-5 text-center font-body text-[11px] text-slate">{iconCreditLine()}</p>
    </section>
  );
}

export function AirtimeLobbyExplainer() {
  const reduce = useReducedMotion();
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setBeat((n) => (n + 1) % PANES.length), PANE_MS);
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
      <div className="grid">
        {PANES.map((pane, i) => (
          <motion.div
            key={pane.caption}
            className="col-start-1 row-start-1"
            initial={false}
            animate={{ opacity: i === beat ? 1 : 0, y: i === beat ? 0 : 6 }}
            transition={{ duration: 0.3, ease: EASE }}
            aria-hidden={i !== beat}
          >
            <PaneBody index={i} />
          </motion.div>
        ))}
      </div>
      <LobbyExplainerDots count={PANES.length} current={beat} />
    </Shell>
  );
}
