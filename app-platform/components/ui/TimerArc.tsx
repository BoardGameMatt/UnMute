"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type TimerArcProps = {
  durationSeconds: number;
  startedAt: string | null;
  onComplete: () => void;
  className?: string;
  size?: number;
};

/**
 * Time Timer–style arc: navy fill diminishes clockwise. No numeric display.
 */
export const TimerArc = ({
  durationSeconds,
  startedAt,
  onComplete,
  className = "",
  size = 168,
}: TimerArcProps) => {
  const doneRef = useRef(false);
  const [, setTick] = useState(0);

  const stableOnComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    doneRef.current = false;
  }, [startedAt, durationSeconds]);

  useEffect(() => {
    if (!startedAt || durationSeconds <= 0) {
      return;
    }

    const startMs = new Date(startedAt).getTime();
    const totalMs = durationSeconds * 1000;
    let frame: number;

    const loop = () => {
      const elapsed = Date.now() - startMs;
      const ratio = Math.min(1, elapsed / totalMs);
      setTick((t) => (t + 1) % 10000);
      if (ratio >= 1 && !doneRef.current) {
        doneRef.current = true;
        stableOnComplete();
        return;
      }
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [startedAt, durationSeconds, stableOnComplete]);

  const cx = size / 2;
  const cy = size / 2;
  const stroke = Math.max(6, size * 0.06);
  const r = cx - stroke;
  const circumference = 2 * Math.PI * r;

  const elapsedRatio =
    startedAt && durationSeconds > 0
      ? Math.min(
          1,
          Math.max(0, (Date.now() - new Date(startedAt).getTime()) / (durationSeconds * 1000))
        )
      : 0;
  const remainingRatio = 1 - elapsedRatio;
  const dashOffset = circumference * (1 - remainingRatio);

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="rotate-[-90deg]"
        aria-hidden
      >
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#E8ECEF"
          strokeWidth={stroke}
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#1B3A5C"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
    </div>
  );
};
