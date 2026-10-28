"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { LobbyExplainerDots } from "@/components/ui/LobbyExplainerDots";
import { SAMPLE_CARD } from "../engine";
import { SayLessCardFace } from "./SayLessCardFace";
import { SayLessTurnControls } from "./SayLessTurnControls";

const EASE = [0.4, 0, 0.2, 1] as const;

const SAMPLE = { id: "sample", name: SAMPLE_CARD.name, hint: SAMPLE_CARD.hint };

const BEATS = [
  {
    caption: "Play on your phone. Keep everyone's video up on your laptop.",
    kind: "device" as const,
  },
  {
    caption:
      "Teams alternate turns. One member of each team gives clues while the rest of their team guesses. The other team listens silently.",
    kind: "teams" as const,
  },
  {
    caption:
      "Round 1: say whatever you want to get your team to guess the card, except the words themselves, derivatives, or spelling. No passing, and your team gets as many guesses as they want. Tap Hint if you don't know the card.",
    kind: "round1" as const,
  },
  {
    caption:
      "When your team guesses correctly, tap Got it. Keep guessing until your team gets it or time runs out.",
    kind: "gotit" as const,
  },
  {
    caption:
      "Round 2: one-word clues only (again, no derivatives), and your team gets one guess. If they guess wrong or you can't come up with something, tap Pass / Oops.",
    kind: "round2" as const,
  },
  {
    caption:
      "Play rotates back and forth between teams until the deck is exhausted. After Round 2, the team with the highest score across both rounds wins!",
    kind: "winner" as const,
  },
];

function DeviceArt() {
  return (
    <svg viewBox="0 0 240 120" className="mx-auto h-28 w-full max-w-[240px]" aria-hidden="true">
      <rect x="16" y="16" width="150" height="88" rx="6" className="fill-unmute-navy" />
      <rect x="24" y="24" width="134" height="72" rx="3" className="fill-warm-white" />
      <rect x="176" y="36" width="48" height="72" rx="8" className="fill-deep-navy" />
      <rect x="181" y="42" width="38" height="54" rx="3" className="fill-warm-white" />
    </svg>
  );
}

function BeatArt({ kind }: { kind: (typeof BEATS)[number]["kind"] }) {
  if (kind === "device") return <DeviceArt />;
  if (kind === "teams") {
    return (
      <div className="mx-auto grid w-full max-w-xs grid-cols-2 gap-3">
        <TeamTile label="Team A" lines={["Maya · clues", "Jordan · guessing", "Sam · guessing"]} />
        <TeamTile label="Team B" lines={["Listening", "Muted. No card."]} muted />
      </div>
    );
  }
  if (kind === "round1") {
    return (
      <div className="mx-auto w-full max-w-xs">
        <SayLessCardFace card={SAMPLE} compact hintOnTap hintButtonHighlighted />
        <p className="mt-3 rounded-md border border-cloud-grey bg-warm-white px-3 py-2 text-center font-body text-sm text-charcoal">
          “It&apos;s an Italian treat. You often have it at parties or on Friday nights, and
          it&apos;s usually very cheesy.”
        </p>
      </div>
    );
  }
  if (kind === "gotit") {
    return (
      <div className="mx-auto w-full max-w-xs">
        <SayLessTurnControls highlight="got_it" disabled passBlocked />
      </div>
    );
  }
  if (kind === "round2") {
    return (
      <div className="mx-auto flex w-full max-w-xs flex-col gap-3">
        <SayLessCardFace card={{ ...SAMPLE, hint: null }} compact />
        <p className="rounded-md border border-cloud-grey bg-warm-white px-3 py-2 text-center font-body text-sm text-charcoal">
          “Cheesy.”
        </p>
        <SayLessTurnControls highlight="pass" disabled />
      </div>
    );
  }
  return (
    <div className="mx-auto grid w-full max-w-xs grid-cols-2 gap-3">
      <ScoreTile label="Team A" score={23} />
      <ScoreTile label="Team B" score={19} />
    </div>
  );
}

function TeamTile({ label, lines, muted = false }: { label: string; lines: string[]; muted?: boolean }) {
  return (
    <div
      className={`rounded-md border border-cloud-grey bg-warm-white px-3 py-4 text-center ${
        muted ? "opacity-70" : ""
      }`}
    >
      <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">{label}</p>
      <ul className="mt-2 space-y-1">
        {lines.map((line) => (
          <li key={line} className="font-body text-sm text-charcoal">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScoreTile({ label, score }: { label: string; score: number }) {
  return (
    <div className="rounded-md border border-cloud-grey bg-warm-white px-3 py-5 text-center">
      <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold text-unmute-navy">{score}</p>
    </div>
  );
}

export function SayLessLobbyExplainer() {
  const reduced = useReducedMotion();
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const timer = window.setInterval(() => setBeat((current) => (current + 1) % BEATS.length), 6500);
    return () => window.clearInterval(timer);
  }, [reduced]);

  return (
    <section
      className="rounded-lg border border-unmute-navy/10 bg-unmute-navy/[0.05] p-6 sm:p-7"
      aria-label="How Say Less works"
    >
      <p className="mb-5 text-center font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
        How it works
      </p>
      <div className={reduced ? "space-y-8" : "grid"}>
        {BEATS.map((item, index) => {
          const visible = reduced || index === beat;
          return (
            <motion.div
              key={item.kind}
              className={reduced ? "space-y-4" : "col-start-1 row-start-1 space-y-4"}
              initial={false}
              animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 6 }}
              transition={{ duration: 0.35, ease: EASE }}
              aria-hidden={!visible}
            >
              <div className="flex min-h-[13rem] items-center justify-center">
                <BeatArt kind={item.kind} />
              </div>
              <p className="text-center font-body text-base text-charcoal">{item.caption}</p>
            </motion.div>
          );
        })}
      </div>
      {reduced ? null : <LobbyExplainerDots count={BEATS.length} current={beat} />}
    </section>
  );
}
