"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import type { PublicBoat } from "../types";
import { EASE } from "./AirtimeChrome";

type Props = {
  boats: PublicBoat[];
  swapMode?: boolean;
  pending?: boolean;
  onSwap?: (a: string, b: string) => void;
};

const BOAT_MASK = "url(/protocols/airtime/boat.svg)";

function BoatGlyph() {
  return (
    <div className="flex flex-col items-center">
      <span
        className="block h-14 w-14 bg-unmute-navy"
        style={{
          maskImage: BOAT_MASK,
          WebkitMaskImage: BOAT_MASK,
          maskSize: "contain",
          WebkitMaskSize: "contain",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskPosition: "center",
          WebkitMaskPosition: "center",
        }}
        aria-hidden="true"
      />
      <span className="mt-1 block h-px w-full bg-steel-blue" aria-hidden="true" />
    </div>
  );
}

const COLS: Record<number, string> = {
  1: "grid-cols-1 max-w-md",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

export function AirtimeBoatsGraphic({ boats, swapMode, pending, onSwap }: Props) {
  const reduce = useReducedMotion();
  const [selected, setSelected] = useState<{ id: string; boatId: string } | null>(null);

  const tap = (participantId: string, boatId: string) => {
    if (!swapMode || pending) return;
    if (!selected) {
      setSelected({ id: participantId, boatId });
      return;
    }
    if (selected.id === participantId) {
      setSelected(null);
      return;
    }
    if (selected.boatId === boatId) {
      setSelected({ id: participantId, boatId });
      return;
    }
    onSwap?.(selected.id, participantId);
    setSelected(null);
  };

  return (
    <div className="space-y-3">
      <div className={`mx-auto grid w-full gap-4 ${COLS[boats.length] ?? "grid-cols-4"}`}>
        {boats.map((boat) => (
          <section key={boat.id} className="rounded-lg border border-cloud-grey bg-warm-white p-6">
            <BoatGlyph />
            <h3 className="mt-4 text-center font-display text-2xl font-medium text-unmute-navy">{boat.name}</h3>
            <ul className="mt-4 space-y-2">
              <AnimatePresence initial={false}>
                {boat.members.map((m) => {
                  const isSel = selected?.id === m.participantId;
                  return (
                    <motion.li
                      key={m.participantId}
                      layout={!reduce}
                      initial={reduce ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={reduce ? undefined : { opacity: 0 }}
                      transition={{ duration: 0.2, ease: EASE }}
                    >
                      {swapMode ? (
                        <button
                          type="button"
                          onClick={() => tap(m.participantId, boat.id)}
                          disabled={pending}
                          aria-pressed={isSel}
                          className={`w-full rounded-md px-3 py-2 text-left font-body text-lg text-charcoal transition-colors duration-200 ${
                            isSel ? "border-2 border-unmute-navy" : "border-2 border-transparent hover:bg-cloud-grey"
                          } disabled:cursor-not-allowed disabled:opacity-40`}
                        >
                          {m.displayName}
                        </button>
                      ) : (
                        <p className="px-3 py-1 font-body text-lg text-charcoal">{m.displayName}</p>
                      )}
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </section>
        ))}
      </div>
      {swapMode ? (
        <p className="text-center font-body text-sm text-slate">
          {selected
            ? "Now tap someone on another boat to swap them."
            : "To swap two people, tap a name, then a name on another boat."}
        </p>
      ) : null}
    </div>
  );
}
