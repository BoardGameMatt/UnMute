"use client";

import { motion } from "framer-motion";
import type { WaoItemVisualState } from "@/lib/wao/types";
import { WaoItemFace } from "./WaoItemFace";

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
  const isMine = state === "mine";
  const isBoth = state === "both";

  return (
    <motion.button
      type="button"
      key={state}
      {...fadeSlide}
      disabled={disabled}
      onClick={onToggle}
      aria-pressed={isMine || isBoth}
      className={`relative w-full transition-opacity duration-200 ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      }`}
    >
      <WaoItemFace
        label={label}
        state={state}
        myInitial={myInitial}
        partnerInitial={partnerInitial}
      />
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
