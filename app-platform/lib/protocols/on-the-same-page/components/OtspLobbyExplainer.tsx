"use client";

import { useEffect, useState } from "react";
import { LobbyExplainerDots } from "@/components/ui/LobbyExplainerDots";
import { motion, useReducedMotion } from "framer-motion";
import { OtspTile } from "./OtspTile";

const BEATS = [
  {
    caption: "Play on your phone. Keep everyone's video up on your laptop.",
    kind: "device" as const,
  },
  {
    caption: "Five players build a picture together on a 10×10 grid, one tile at a time. On your turn: tap a tile, tap a square, tap Place.",
    kind: "grid" as const,
  },
  {
    caption: "Builders know the picture. Build it so the Inspectors can name it, but the Improviser can't.",
    kind: "builder" as const,
  },
  {
    caption: "The Improviser doesn't know the picture. Place tiles that fit, and work out what it is.",
    kind: "improviser" as const,
  },
  {
    caption: "Inspectors watch. Lock the picture, and pin who is improvising.",
    kind: "inspector" as const,
  },
  {
    caption: "Lock the right picture early for the most points. Pin the Improviser for 2 more. Builders score when the Inspectors get it and the Improviser doesn't.",
    kind: "score" as const,
  },
];

const EASE = [0.4, 0, 0.2, 1] as const;

function DeviceArt() {
  return (
    <svg viewBox="0 0 240 120" className="mx-auto h-28 w-full max-w-[240px]" aria-hidden="true">
      <rect x="16" y="16" width="150" height="88" rx="6" className="fill-unmute-navy" />
      <rect x="24" y="24" width="134" height="72" rx="3" className="fill-warm-white" />
      <rect x="176" y="36" width="48" height="72" rx="8" className="fill-deep-navy" />
      <rect x="181" y="42" width="38" height="54" rx="3" className="fill-warm-white" />
    </svg>
  );
}

function MiniGrid() {
  return (
    <div className="mx-auto grid w-36 grid-cols-4 gap-px rounded-md bg-cloud-grey p-px" aria-hidden="true">
      {Array.from({ length: 16 }, (_, index) => {
        const tile = index === 5 ? "half_bottom" : index === 6 ? "half_bottom" : index === 9 ? "square" : null;
        return (
          <div key={index} className="aspect-square bg-warm-white">
            {tile ? <OtspTile tile={tile} color="indigo" className="h-full w-full" /> : null}
          </div>
        );
      })}
    </div>
  );
}

function BeatArt({ kind }: { kind: (typeof BEATS)[number]["kind"] }) {
  if (kind === "device") return <DeviceArt />;
  if (kind === "grid" || kind === "improviser") return <MiniGrid />;
  if (kind === "builder" || kind === "score") {
    return (
      <div className="mx-auto w-full max-w-xs rounded-lg border border-cloud-grey bg-warm-white px-4 py-5 text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">Sample</p>
        <p className="mt-2 font-display text-2xl font-semibold text-unmute-navy">Rubber duck</p>
      </div>
    );
  }
  return (
    <div className="mx-auto flex w-full max-w-xs gap-3">
      <div className="flex-1 rounded-md border border-unmute-navy bg-warm-white px-3 py-4 text-center font-body text-sm text-unmute-navy">
        Rubber duck
      </div>
      <div className="flex-1 rounded-md border-2 border-unmute-navy bg-warm-white px-3 py-4 text-center font-body text-sm text-charcoal">
        Pin a builder
      </div>
    </div>
  );
}

export function OtspLobbyExplainer() {
  const reduced = useReducedMotion();
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const timer = window.setInterval(() => setBeat((current) => (current + 1) % BEATS.length), 8000);
    return () => window.clearInterval(timer);
  }, [reduced]);

  return (
    <section className="rounded-lg border border-unmute-navy/10 bg-unmute-navy/[0.05] p-6 sm:p-7">
      <p className="mb-5 text-center font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
        How it works
      </p>
      <div className={reduced ? "space-y-8" : "grid"}>
        {BEATS.map((item, index) => {
          const visible = reduced || index === beat;
          return (
            <motion.div
              key={item.kind}
              className={reduced ? "space-y-4" : "col-start-1 row-start-1 space-y-4"}
              initial={false}
              animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 6 }}
              transition={{ duration: 0.35, ease: EASE }}
              aria-hidden={!visible}
            >
              <div className="flex min-h-[9rem] items-center justify-center">
                <BeatArt kind={item.kind} />
              </div>
              <p className="text-center font-body text-base text-charcoal">{item.caption}</p>
            </motion.div>
          );
        })}
      </div>
      {reduced ? null : <LobbyExplainerDots count={BEATS.length} current={beat} />}
    </section>
  );
}
