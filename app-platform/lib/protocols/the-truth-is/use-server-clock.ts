"use client";

import { useRef } from "react";

/**
 * Difference between the server clock and this phone, in milliseconds.
 * Captured once per server timestamp so the arc keeps moving between polls.
 */
export function useServerClockOffset(serverNow: string | null | undefined): number {
  const offsetRef = useRef(0);
  const seenRef = useRef<string | null>(null);
  if (serverNow && serverNow !== seenRef.current) {
    const serverMs = Date.parse(serverNow);
    if (!Number.isNaN(serverMs)) {
      offsetRef.current = serverMs - Date.now();
      seenRef.current = serverNow;
    }
  }
  return offsetRef.current;
}

/** Milliseconds from the corrected clock until the server timer is done. */
export function msUntilServerDue(
  startedAt: string | null,
  durationSeconds: number,
  clockOffsetMs: number,
  nowMs = Date.now()
): number | null {
  if (!startedAt || durationSeconds <= 0) return null;
  const start = Date.parse(startedAt);
  if (Number.isNaN(start)) return null;
  return start + durationSeconds * 1000 - (nowMs + clockOffsetMs);
}
