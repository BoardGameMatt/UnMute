"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { AirtimePlayState } from "../types";
import { BANNER, Banner, EASE } from "./AirtimeChrome";
import { RevealLine } from "./AirtimeResults";

type Props = {
  final: NonNullable<AirtimePlayState["final"]>;
  meId: string | null;
  large?: boolean;
};

function Trend({ totals, max }: { totals: number[]; max: number }) {
  return (
    <div className="flex items-end gap-1.5" aria-label={`Dive totals: ${totals.join(", ")}`}>
      {totals.map((t, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <span
            className="w-5 rounded-sm bg-steel-blue"
            style={{ height: `${Math.max(4, Math.round((t / Math.max(1, max)) * 40))}px` }}
          />
          <span className="font-mono text-[10px] text-steel-blue">{t}</span>
        </div>
      ))}
    </div>
  );
}

function winnerLine(final: Props["final"]): string {
  const names = final.standings.filter((s) => s.isWinner).map((s) => s.name);
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} wins.`;
  const last = names[names.length - 1];
  return `${names.slice(0, -1).join(", ")} and ${last} tie.`;
}

export function AirtimeFinal({ final, meId, large }: Props) {
  const reduce = useReducedMotion();
  const maxDive = Math.max(1, ...final.standings.flatMap((s) => s.diveTotals));

  return (
    <div className="space-y-5">
      <Banner>{BANNER.open}</Banner>
      <RevealLine />
      <h2 className={`font-display ${large ? "text-4xl" : "text-3xl"} font-bold text-unmute-navy`}>
        {winnerLine(final)}
      </h2>

      <ol className="space-y-4">
        {final.standings.map((s, i) => (
          <motion.li
            key={s.boatId}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE, delay: reduce ? 0 : i * 0.12 }}
            className={`rounded-lg border bg-warm-white p-6 ${s.isWinner ? "border-2 border-signal-amber" : "border-cloud-grey"}`}
          >
            {s.isWinner ? (
              <p className="font-mono text-[10px] uppercase tracking-widest text-signal-amber">Winning boat</p>
            ) : null}
            <div className="mt-1 flex items-end justify-between gap-4">
              <div>
                <p className={`font-display ${large ? "text-2xl" : "text-xl"} font-semibold text-unmute-navy`}>
                  {s.name}
                </p>
                <p className="font-display text-3xl font-bold text-unmute-navy">{s.total}</p>
              </div>
              <Trend totals={s.diveTotals} max={maxDive} />
            </div>
            {s.isRival ? (
              <p className="mt-2 font-body text-sm text-slate">Rival boat.</p>
            ) : (
              <ul className="mt-3 space-y-1 border-t border-cloud-grey pt-3">
                {s.members.map((m) => (
                  <li key={m.participantId} className="flex justify-between font-body text-base text-charcoal">
                    <span>
                      {m.displayName}
                      {m.participantId === meId ? <span className="ml-1 text-slate">(you)</span> : null}
                    </span>
                    <span className="font-mono text-sm text-steel-blue">
                      {m.personalTotal} of {s.total}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </motion.li>
        ))}
      </ol>
    </div>
  );
}
