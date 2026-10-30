"use client";

import { motion } from "framer-motion";

type CriterionBarChartProps = {
  criterionHits: Record<string, number>;
  maxParticipants: number;
};

export const CriterionBarChart = ({
  criterionHits,
  maxParticipants,
}: CriterionBarChartProps) => {
  const entries = Object.entries(criterionHits);

  if (entries.length === 0) {
    return (
      <p className="text-center font-body text-sm text-slate">No responses yet.</p>
    );
  }

  return (
    <ul className="space-y-4">
      {entries.map(([text, hits], index) => {
        const ratio = maxParticipants > 0 ? hits / maxParticipants : 0;
        const widthPct = Math.round(ratio * 100);
        return (
          <motion.li
            key={text}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05, ease: [0.4, 0, 0.2, 1] }}
          >
            <p className="font-body text-sm text-charcoal">{text}</p>
            <motion.div
              className="mt-2 flex items-center gap-3"
              aria-hidden
            >
              <motion.div className="h-3 flex-1 overflow-hidden rounded-md bg-cloud-grey">
                <motion.div
                  className="h-full rounded-md bg-unmute-navy"
                  initial={{ width: 0 }}
                  animate={{ width: `${widthPct}%` }}
                  transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                />
              </motion.div>
              <span className="shrink-0 font-mono text-xs text-slate">{hits}</span>
            </motion.div>
          </motion.li>
        );
      })}
    </ul>
  );
};
