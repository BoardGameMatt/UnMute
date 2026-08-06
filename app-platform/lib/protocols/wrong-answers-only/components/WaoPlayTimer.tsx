"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

type WaoPlayTimerProps = {
  durationSeconds: number;
  startedAt: string | null;
  onComplete: () => void;
  /** Amber stroke + pulse inside the final N seconds (spec §8.2). */
  urgentBelowSeconds?: number;
  /** Integer countdown appears only in the final N seconds. */
  numericBelowSeconds?: number;
  size?: number;
  className?: string;
};

const EASE = [0.4, 0, 0.2, 1] as const;

/**
 * Time-timer arc for WAO play. Navy by default; signal-amber + subtle pulse
 * in the final 15 seconds; integer 3-2-1 only in the final 3 seconds.
 *
 * onComplete is held in a ref so parent identity churn does not tear down the
 * rAF loop. The remaining arc uses explicit dash length (not only dashoffset)
 * so a full disc stays visible at t=start in WebKit.
 */
export function WaoPlayTimer({
  durationSeconds,
  startedAt,
  onComplete,
  urgentBelowSeconds = 15,
  numericBelowSeconds = 3,
  size = 120,
  className = "",
}: WaoPlayTimerProps) {
  const doneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const [, setTick] = useState(0);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    doneRef.current = false;
  }, [startedAt, durationSeconds]);

  useEffect(() => {
    if (!startedAt || durationSeconds <= 0) return;

    const startMs = new Date(startedAt).getTime();
    if (Number.isNaN(startMs)) return;

    const totalMs = durationSeconds * 1000;
    let frame = 0;

    const loop = () => {
      const elapsed = Date.now() - startMs;
      const ratio = Math.min(1, Math.max(0, elapsed / totalMs));
      setTick((t) => (t + 1) % 10000);
      if (ratio >= 1) {
        if (!doneRef.current) {
          doneRef.current = true;
          onCompleteRef.current();
        }
        return;
      }
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [startedAt, durationSeconds]);

  if (!startedAt || durationSeconds <= 0) {
    return null;
  }

  const startMs = new Date(startedAt).getTime();
  if (Number.isNaN(startMs)) {
    return null;
  }

  const cx = size / 2;
  const cy = size / 2;
  const stroke = Math.max(10, size * 0.1);
  const r = cx - stroke;
  const circumference = 2 * Math.PI * r;

  const elapsedRatio = Math.min(
    1,
    Math.max(0, (Date.now() - startMs) / (durationSeconds * 1000))
  );
  const remainingRatio = 1 - elapsedRatio;
  const remainingSeconds = durationSeconds * remainingRatio;
  const urgent = remainingSeconds > 0 && remainingSeconds <= urgentBelowSeconds;
  const showCountdown =
    remainingSeconds > 0 && remainingSeconds <= numericBelowSeconds;
  const countdownDigit = showCountdown ? Math.ceil(remainingSeconds) : null;
  // Explicit visible length — full-circle dashoffset=0 is unreliable in WebKit.
  const arcLength = Math.max(0, circumference * remainingRatio);

  // SVG stroke cannot use Tailwind tokens; match config hex for navy / amber.
  const strokeColor = urgent ? "#F5A623" : "#1B3A5C";

  return (
    <div
      className={`relative flex flex-col items-center justify-center ${className}`}
      role="timer"
      aria-label={
        countdownDigit !== null
          ? `${countdownDigit} seconds remaining`
          : urgent
            ? "Time running out"
            : remainingRatio <= 0
              ? "Time is up"
              : "Round timer"
      }
      aria-live={showCountdown ? "polite" : undefined}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <motion.div
          className="absolute inset-0"
          animate={
            urgent
              ? { opacity: [1, 0.55, 1], scale: [1, 0.97, 1] }
              : { opacity: 1, scale: 1 }
          }
          transition={
            urgent
              ? { duration: 1, repeat: Infinity, ease: EASE }
              : { duration: 0.2, ease: EASE }
          }
        >
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
              stroke={strokeColor}
              strokeWidth={stroke}
              strokeLinecap="butt"
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeDashoffset={0}
            />
          </svg>
        </motion.div>

        {countdownDigit !== null ? (
          <span
            className="pointer-events-none absolute inset-0 flex items-center justify-center font-display text-5xl font-bold tabular-nums text-unmute-navy"
            aria-hidden
          >
            {countdownDigit}
          </span>
        ) : null}
      </div>
    </div>
  );
}
