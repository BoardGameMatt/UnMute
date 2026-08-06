"use client";

import { motion } from "framer-motion";
import type { WaoItemVisualState } from "@/lib/wao/types";

type WaoItemButtonProps = {
  label: string;
  state: WaoItemVisualState;
  myInitial: string;
  partnerInitial: string;
  unconfirmed: boolean;
  disabled: boolean;
  onToggle: () => void;
};

const fadeSlide = {
  initial: { opacity: 0.7, y: 4 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const },
};

/**
 * Four-state item control. Greyscale-distinguishable via border weight, dash,
 * fill, chips, and checkmark — not colour alone (spec §8.1).
 */
export function WaoItemButton({
  label,
  state,
  myInitial,
  partnerInitial,
  unconfirmed,
  disabled,
  onToggle,
}: WaoItemButtonProps) {
  const isBoth = state === "both";
  const isMine = state === "mine";
  const isTheirs = state === "theirs";

  let shell =
    "relative flex w-full items-center gap-3 rounded-lg px-4 py-3.5 text-left transition-opacity duration-200 ";
  if (isBoth) {
    shell += "border-2 border-unmute-navy bg-unmute-navy text-warm-white";
  } else if (isMine) {
    shell +=
      "border-2 border-unmute-navy bg-warm-white text-charcoal border-l-4";
  } else if (isTheirs) {
    shell +=
      "border-2 border-dashed border-unmute-navy bg-warm-white text-charcoal";
  } else {
    shell +=
      "border border-unmute-navy/20 bg-warm-white text-charcoal";
  }

  if (disabled) shell += " opacity-60 cursor-not-allowed";
  else shell += " cursor-pointer";

  return (
    <motion.button
      type="button"
      key={state}
      {...fadeSlide}
      disabled={disabled}
      onClick={onToggle}
      aria-pressed={isMine || isBoth}
      className={shell}
    >
      <span className="min-w-0 flex-1 font-body text-base leading-snug">
        {label}
      </span>

      <span className="flex shrink-0 items-center gap-1.5" aria-hidden>
        {(isMine || isBoth) && (
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full font-mono text-[10px] font-medium ${
              isBoth
                ? "bg-warm-white text-unmute-navy"
                : "bg-unmute-navy text-warm-white"
            }`}
          >
            {myInitial}
          </span>
        )}
        {(isTheirs || isBoth) && (
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full font-mono text-[10px] font-medium ${
              isBoth
                ? "bg-warm-white/90 text-unmute-navy"
                : "border border-unmute-navy text-unmute-navy"
            }`}
          >
            {partnerInitial}
          </span>
        )}
        {isBoth && (
          <span className="ml-0.5 font-mono text-sm text-warm-white" aria-label="both selected">
            ✓
          </span>
        )}
      </span>

      {unconfirmed && (
        <span
          className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-steel-blue"
          title="Syncing"
          aria-label="Tap not yet confirmed"
        />
      )}
    </motion.button>
  );
}
