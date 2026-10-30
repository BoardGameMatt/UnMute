"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { AirtimePlayState, HaulRow } from "../types";
import { BANNER, Banner, EASE, REVEAL_LINE } from "./AirtimeChrome";
import { ItemGlyph } from "./AirtimeItemCard";

type Props = {
  results: NonNullable<AirtimePlayState["results"]>;
  meId: string | null;
  large?: boolean;
};

function HaulLine({ row, mine, large }: { row: HaulRow; mine: boolean; large?: boolean }) {
  const gone = row.status !== "surfaced";
  return (
    <div
      className={`flex items-center gap-3 rounded-md border px-4 py-3 ${
        mine ? "border-unmute-navy" : "border-cloud-grey"
      } bg-warm-white`}
    >
      <ItemGlyph itemId={row.itemId} level={row.level} dark={false} muted={gone} sizeClass="h-8 w-8" />
      <div className="min-w-0 flex-1">
        <p className={`font-body ${large ? "text-lg" : "text-base"} font-medium text-charcoal`}>
          {row.displayName}
        </p>
        <p className="truncate font-body text-sm text-slate">{row.itemName}</p>
      </div>
      {gone ? (
        <span
          className={`font-mono text-[10px] uppercase tracking-widest ${
            row.status === "lost" ? "text-signal-red" : "text-steel-blue"
          }`}
        >
          {row.status === "lost" ? "Lost" : "Forfeit"}
        </span>
      ) : null}
      <span className={`w-10 text-right font-display ${large ? "text-2xl" : "text-xl"} font-semibold text-unmute-navy`}>
        {row.value}
      </span>
    </div>
  );
}

export function RevealLine() {
  const reduce = useReducedMotion();
  return (
    <motion.p
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="rounded-lg border-l-4 border-signal-amber bg-warm-white px-5 py-4 font-display text-xl font-semibold text-unmute-navy"
    >
      {REVEAL_LINE}
    </motion.p>
  );
}

export function AirtimeResults({ results, meId, large }: Props) {
  const reduce = useReducedMotion();
  const stagger = (i: number) => ({
    initial: reduce ? false : { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, ease: EASE, delay: reduce ? 0 : i * 0.1 },
  });

  return (
    <div className="space-y-5">
      <Banner>{BANNER.open}</Banner>
      <h2 className={`font-display ${large ? "text-3xl" : "text-2xl"} font-semibold text-unmute-navy`}>
        Dive {results.dive} results
      </h2>

      <ul className="space-y-2">
        {results.hauls.map((row, i) => (
          <motion.li key={row.participantId} {...stagger(i)}>
            <HaulLine row={row} mine={row.participantId === meId} large={large} />
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
