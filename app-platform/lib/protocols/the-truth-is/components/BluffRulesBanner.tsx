"use client";

/** Compact persistent cue for the reader-author during discussion + voting (bluff rounds). */
export const BluffRulesBanner = () => (
  <div
    className="mb-6 rounded-md border-l-4 border-signal-amber bg-unmute-navy px-4 py-3 text-left shadow-sm"
    role="note"
  >
    <p className="font-mono text-[11px] font-normal leading-relaxed text-warm-white/95 sm:text-xs">
      This one&apos;s yours. Earn points for each person who guesses someone else.
      Perfect bluff = bonus point.
    </p>
  </div>
);
