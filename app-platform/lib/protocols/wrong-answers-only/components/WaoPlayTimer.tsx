"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type WaoPlayTimerProps = {
  durationSeconds: number;
  startedAt: string | null;
  onComplete: () => void;
  /** Amber stroke only inside the final N seconds (spec §8.2). */
  urgentBelowSeconds?: number;
  size?: number;
  className?: string;
};

/**
 * Time-timer arc for WAO play. Navy by default; signal-amber in the final
 * 15 seconds. No numeric countdown.
 */
export function WaoPlayTimer({
  durationSeconds,
  startedAt,
  onComplete,
  urgentBelowSeconds = 15,
  size = 120,
  className = "",
}: WaoPlayTimerProps) {
  const doneRef = useRef(false);
  const [, setTick] = useState(0);

  const stableOnComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    doneRef.current = false;
  }, [startedAt, durationSeconds]);

  useEffect(() => {
    if (!startedAt || durationSeconds <= 0) return;

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
          Math.max(
            0,
            (Date.now() - new Date(startedAt).getTime()) / (durationSeconds * 1000)
          )
        )
      : 0;
  const remainingRatio = 1 - elapsedRatio;
  const remainingSeconds = durationSeconds * remainingRatio;
  const urgent = remainingSeconds > 0 && remainingSeconds <= urgentBelowSeconds;
  const dashOffset = circumference * (1 - remainingRatio);

  // SVG stroke cannot use Tailwind tokens; match config hex for navy / amber.
  const strokeColor = urgent ? "#F5A623" : "#1B3A5C";

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      aria-hidden
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="rotate-[-90deg]"
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
          stroke={strokeColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
    </div>
  );
}
