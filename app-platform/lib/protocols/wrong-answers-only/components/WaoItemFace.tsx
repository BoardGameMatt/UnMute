"use client";

import type { WaoItemVisualState } from "@/lib/wao/types";

type WaoItemFaceProps = {
  label: string;
  state: WaoItemVisualState;
  myInitial?: string;
  partnerInitial?: string;
  className?: string;
  /** Slightly tighter for dense layouts. */
  compact?: boolean;
  /**
   * Lobby/reveal teaching: eliminated item that belonged.
   * Matches reveal danger bucket (signal-red border, warm-white fill).
   */
  mistake?: boolean;
  /** Inline label when mistake is set (e.g. "belonged"). */
  mistakeLabel?: string;
};

/**
 * Shared four-state face for play and lobby explainer (spec §8.1).
 * Not interactive — wrap in a button when taps are needed.
 */
export function WaoItemFace({
  label,
  state,
  myInitial = "Y",
  partnerInitial = "P",
  className = "",
  compact = false,
  mistake = false,
  mistakeLabel,
}: WaoItemFaceProps) {
  const isBoth = state === "both";
  const isMine = state === "mine";
  const isTheirs = state === "theirs";

  let shell =
    "relative flex w-full items-center rounded-lg text-left ";
  shell += compact ? "gap-2 px-3 py-2.5 " : "gap-3 px-4 py-3.5 ";
  if (mistake) {
    shell += "border-2 border-signal-red bg-warm-white text-charcoal";
  } else if (isBoth) {
    shell += "border-2 border-unmute-navy bg-unmute-navy text-warm-white";
  } else if (isMine) {
    shell +=
      "border-2 border-unmute-navy bg-warm-white text-charcoal border-l-4";
  } else if (isTheirs) {
    shell +=
      "border-2 border-dashed border-unmute-navy bg-warm-white text-charcoal";
  } else {
    shell += "border border-unmute-navy/20 bg-warm-white text-charcoal";
  }

  return (
    <div className={`${shell} ${className}`.trim()}>
      <span
        className={`min-w-0 flex-1 font-body leading-snug ${
          compact ? "text-sm" : "text-base"
        }`}
      >
        {label}
        {mistake && mistakeLabel ? (
          <span className="ml-2 font-mono text-[10px] font-medium uppercase tracking-widest text-signal-red">
            {mistakeLabel}
          </span>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {(isMine || isBoth) && (
          <span
            className={`flex items-center justify-center rounded-full font-mono font-medium ${
              compact ? "h-5 w-5 text-[9px]" : "h-6 w-6 text-[10px]"
            } ${
              mistake
                ? "bg-signal-red text-warm-white"
                : isBoth
                  ? "bg-warm-white text-unmute-navy"
                  : "bg-unmute-navy text-warm-white"
            }`}
          >
            {myInitial}
          </span>
        )}
        {(isTheirs || isBoth) && (
          <span
            className={`flex items-center justify-center rounded-full font-mono font-medium ${
              compact ? "h-5 w-5 text-[9px]" : "h-6 w-6 text-[10px]"
            } ${
              mistake
                ? "border border-signal-red text-signal-red"
                : isBoth
                  ? "bg-warm-white/90 text-unmute-navy"
                  : "border border-unmute-navy text-unmute-navy"
            }`}
          >
            {partnerInitial}
          </span>
        )}
        {isBoth && !mistake && (
          <span
            className={`ml-0.5 font-mono text-warm-white ${
              compact ? "text-xs" : "text-sm"
            }`}
          >
            ✓
          </span>
        )}
      </span>
    </div>
  );
}
