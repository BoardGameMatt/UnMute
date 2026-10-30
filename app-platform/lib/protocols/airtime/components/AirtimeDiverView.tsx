"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Choice, DiverView } from "../types";
import { AirtimeAirGauge } from "./AirtimeAirGauge";
import { BANNER, Banner, BoatmateChip, DepthGauge, EASE } from "./AirtimeChrome";
import { AirtimeItemCard } from "./AirtimeItemCard";

type Props = {
  diver: DiverView;
  /** "closed": the visible clock hit zero; the server is still collecting in-flight taps. */
  windowState: "beat" | "open" | "closed";
  pending: boolean;
  onChoose: (choice: Choice) => void;
};

function ChoiceButton({
  label,
  glyph,
  selected,
  dimmed,
  disabled,
  onClick,
}: {
  label: string;
  glyph: string;
  selected: boolean;
  dimmed: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`flex min-h-[64px] flex-1 items-center justify-center gap-2 rounded-md px-4 py-4 font-display text-lg font-semibold transition-colors duration-200 ${
        selected
          ? "bg-unmute-navy text-warm-white"
          : "border-2 border-cloud-grey bg-warm-white text-unmute-navy hover:bg-cloud-grey"
      } ${dimmed ? "opacity-40" : ""} disabled:cursor-not-allowed ${
        !selected && disabled ? "opacity-40" : ""
      }`}
    >
      <span aria-hidden="true">{selected ? "✓" : glyph}</span>
      {label}
    </button>
  );
}

export function AirtimeDiverView({ diver, windowState, pending, onChoose }: Props) {
  const reduce = useReducedMotion();
  const chosen = diver.chosen;
  const locked = chosen !== null || windowState !== "open" || pending;

  return (
    <div className="space-y-5">
      <Banner>{BANNER.diver}</Banner>

      <div className="flex gap-4">
        <DepthGauge depth={diver.depth} />
        <div className="min-w-0 flex-1 space-y-4">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${diver.item.id}-${diver.depth}`}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              <AirtimeItemCard
                itemId={diver.item.id}
                name={diver.item.name}
                level={diver.item.level}
                value={null}
                state="underwater"
                compact
              />
            </motion.div>
          </AnimatePresence>
          <AirtimeAirGauge label={diver.gauge.label} segments={diver.gauge.segments} />
        </div>
      </div>

      {diver.boatmates.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {diver.boatmates.map((m) => (
            <BoatmateChip key={m.participantId} name={m.displayName} status={m.status} />
          ))}
        </div>
      ) : null}

      <div className="flex gap-3">
        <ChoiceButton
          label="Dive Deeper"
          glyph="↓"
          selected={chosen === "deeper"}
          dimmed={chosen === "up"}
          disabled={locked || !diver.canDeeper}
          onClick={() => onChoose("deeper")}
        />
        <ChoiceButton
          label="Swim back up"
          glyph="↑"
          selected={chosen === "up"}
          dimmed={chosen === "deeper"}
          disabled={locked}
          onClick={() => onChoose("up")}
        />
      </div>
      <p className="text-center font-body text-sm text-slate">
        {chosen
          ? "Locked in. Waiting for the turn to close."
          : windowState === "beat"
            ? "Next turn opens in a moment."
            : windowState === "closed"
              ? "Time's up. You'll swim back up this turn."
            : !diver.canDeeper
              ? "You're as deep as it goes."
              : "Pick one. You can't change it."}
      </p>
    </div>
  );
}
