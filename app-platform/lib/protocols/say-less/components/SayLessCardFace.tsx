"use client";

import { useEffect, useState } from "react";
import type { SayLessCardView } from "../types";

type SayLessCardFaceProps = {
  card: SayLessCardView;
  compact?: boolean;
  /** Hide the hint behind a Hint button (round 1 turns). Otherwise the hint shows if present. */
  hintOnTap?: boolean;
  /** Explainer only: show the Hint button already pressed. */
  hintButtonHighlighted?: boolean;
};

export const SayLessCardFace = ({
  card,
  compact = false,
  hintOnTap = false,
  hintButtonHighlighted = false,
}: SayLessCardFaceProps) => {
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    setShowHint(false);
  }, [card.id]);

  const hintVisible = card.hint && (!hintOnTap || showHint);

  return (
    <article
      className={`rounded-lg border border-cloud-grey bg-warm-white text-center shadow-sm ${
        compact ? "px-4 py-4" : "px-6 py-7"
      }`}
    >
      <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
        Card
      </p>
      <h2
        className={`mt-2 font-display font-bold text-unmute-navy ${
          compact ? "text-xl" : "text-3xl"
        }`}
      >
        {card.name}
      </h2>
      {hintVisible ? (
        <p className={`mt-3 font-body text-slate ${compact ? "text-sm" : "text-base"}`}>
          {card.hint}
        </p>
      ) : null}
      {hintOnTap && card.hint && !showHint ? (
        <button
          type="button"
          onClick={() => setShowHint(true)}
          className={`mt-3 rounded-md border px-4 py-1.5 font-body text-sm text-unmute-navy transition-colors hover:bg-cloud-grey ${
            hintButtonHighlighted ? "border-2 border-unmute-navy" : "border-cloud-grey"
          }`}
        >
          Hint
        </button>
      ) : null}
    </article>
  );
};
