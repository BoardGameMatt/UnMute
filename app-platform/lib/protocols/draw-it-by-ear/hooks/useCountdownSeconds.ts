"use client";

import { useEffect, useState } from "react";

function remainingFor(targetIso: string | null): number {
  if (!targetIso) return 0;
  const ms = new Date(targetIso).getTime() - Date.now();
  return ms <= 0 ? 0 : Math.ceil(ms / 1000);
}

/**
 * Whole seconds left until `targetIso`, ticking down to 0. Derived from a
 * server-persisted timestamp so every client in the room counts together.
 */
export function useCountdownSeconds(targetIso: string | null): number {
  const [remaining, setRemaining] = useState(() => remainingFor(targetIso));

  useEffect(() => {
    setRemaining(remainingFor(targetIso));
    if (!targetIso) return;

    const id = window.setInterval(() => {
      const next = remainingFor(targetIso);
      setRemaining(next);
      if (next === 0) window.clearInterval(id);
    }, 200);

    return () => window.clearInterval(id);
  }, [targetIso]);

  return remaining;
}
