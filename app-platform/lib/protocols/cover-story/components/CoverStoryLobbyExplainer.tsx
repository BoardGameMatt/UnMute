"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

const EASE = [0.4, 0, 0.2, 1] as const;
const BEATS = [
  {
    title: "Device",
    body: "Play on your phone. Keep everyone’s video up on your laptop.",
  },
  {
    title: "Core action",
    body: "You will read a short passage, five screens, at your own pace.",
  },
  {
    title: "Constraint",
    body: "Read silently. Do not talk until the lead opens discussion.",
  },
  {
    title: "Upside",
    body: "You will come back with one insight for the team.",
  },
  {
    title: "No score yet",
    body: "There is no score in this reading. The discussion is the point.",
  },
] as const;

export function CoverStoryLobbyExplainer() {
  const reduceMotion = useReducedMotion();
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = window.setInterval(() => {
      setBeat((current) => (current + 1) % BEATS.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [reduceMotion]);

  if (reduceMotion) {
    return (
      <section className="rounded-lg border border-unmute-navy/10 bg-unmute-navy/[0.05] p-6 sm:p-7">
        <p className="mb-5 text-center font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
          How it works
        </p>
        <ul className="space-y-4">
          {BEATS.map((item) => (
            <li key={item.title}>
              <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
                {item.title}
              </p>
              <p className="mt-1 font-body text-sm text-charcoal">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  const current = BEATS[beat] ?? BEATS[0];

  return (
    <section className="rounded-lg border border-unmute-navy/10 bg-unmute-navy/[0.05] p-6 sm:p-7">
      <p className="mb-5 text-center font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
        How it works
      </p>
      <AnimatePresence mode="wait">
        <motion.div
          key={current.title}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="min-h-[88px] text-center"
        >
          <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
            {current.title}
          </p>
          <p className="mt-2 font-body text-base text-charcoal">{current.body}</p>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

const REVEAL_BEATS = [
  {
    title: "Device",
    body: "Phone for the mission form and guessing. The board is at the front of the room.",
  },
  {
    title: "Core action",
    body: "File proof for all five words, then name each person’s agency in silence.",
  },
  {
    title: "Constraint",
    body: "Guessing is silent. Ninety seconds. The facilitator advances. Only they score.",
  },
  {
    title: "Upside",
    body: "You score if you catch a cover other people missed. They score if some, not all, of you are right.",
  },
  {
    title: "Penalty",
    body: "If nobody is right, or everybody is right, that person scores nothing for being guessed.",
  },
] as const;

export function CoverStoryRevealExplainer() {
  return (
    <section className="rounded-lg border border-unmute-navy/10 bg-unmute-navy/[0.05] p-6 sm:p-7">
      <p className="mb-5 text-center font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
        How it works
      </p>
      <ul className="space-y-4">
        {REVEAL_BEATS.map((item) => (
          <li key={item.title}>
            <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
              {item.title}
            </p>
            <p className="mt-1 font-body text-sm text-charcoal">{item.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
