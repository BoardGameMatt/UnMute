"use client";

import { WaoPlayTimer } from "@/lib/protocols/wrong-answers-only/components/WaoPlayTimer";
import { isBefore } from "./AirtimeChrome";

type Props = {
  windowOpensAt: string | null;
  turnSeconds: number;
  turn: number;
  now: number;
  clockOffsetMs: number;
  onExpire: () => void;
  size?: number;
};

/** Hidden during the 2s result beat; arc only (3-2-1 in the last 3s) once the window opens. */
export function AirtimeTurnTimer({ windowOpensAt, turnSeconds, turn, now, clockOffsetMs, onExpire, size = 88 }: Props) {
  if (!windowOpensAt) return null;
  if (isBefore(now, windowOpensAt)) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ height: size }}>
        <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">Next turn</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-1">
      <WaoPlayTimer
        key={`${turn}-${windowOpensAt}`}
        durationSeconds={turnSeconds}
        startedAt={windowOpensAt}
        onComplete={onExpire}
        clockOffsetMs={clockOffsetMs}
        retryMs={1500}
        urgentBelowSeconds={5}
        numericBelowSeconds={3}
        size={size}
      />
      <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">Turn {turn}</p>
    </div>
  );
}
