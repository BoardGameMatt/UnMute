"use client";

import type { TalkTrackWordOutcome, TalkTrackWordView } from "../types";

function rowClass(outcome: TalkTrackWordOutcome, isCurrent: boolean): string {
  if (outcome === "scored") return "border border-unmute-navy bg-warm-white";
  if (outcome === "passed") return "border-2 border-dashed border-unmute-navy bg-warm-white";
  if (outcome === "expired") return "border border-cloud-grey bg-warm-white";
  if (isCurrent) return "border-2 border-unmute-navy border-l-4 bg-warm-white";
  return "border border-cloud-grey bg-warm-white";
}

function textClass(outcome: TalkTrackWordOutcome, isCurrent: boolean): string {
  if (isCurrent) return "font-body text-base text-charcoal";
  if (outcome === "unset" || outcome === "expired") {
    return "font-body text-base text-slate";
  }
  return "font-body text-base text-charcoal";
}

type WordLadderProps = {
  words: TalkTrackWordView[];
  currentSlot?: number;
};

export function WordLadder({ words, currentSlot }: WordLadderProps) {
  return (
    <ol className="flex flex-col gap-2">
      {words.map((word) => {
        const current = currentSlot === word.slot && word.outcome === "unset";
        const mark =
          word.outcome === "scored" ? "✓ " : word.outcome === "passed" ? "— " : "";
        return (
          <li
            key={word.slot}
            className={`flex items-center justify-between rounded-lg px-4 py-3 ${rowClass(word.outcome, current)}`}
          >
            <span className={textClass(word.outcome, current)}>
              {mark}
              {word.text}
            </span>
            <span
              className={`font-mono text-sm ${
                current ? "text-steel-blue" : "text-slate"
              }`}
            >
              {word.points}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
