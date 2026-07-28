"use client";

import { useCallback, useEffect, useState } from "react";
import type { SendActionResult } from "@/components/providers/SessionProvider";
import type { DibePhase } from "../types";

type LeadAdvanceControlProps = {
  phase: DibePhase;
  sendAction: (type: string, payload: object) => Promise<SendActionResult>;
};

/**
 * Lead-only recovery control for timed phases. Deliberately secondary — the
 * timer is the expected path; this exists so a stall cannot deadlock the room.
 */
export const LeadAdvanceControl = ({
  phase,
  sendAction,
}: LeadAdvanceControlProps) => {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // A successful advance changes the phase, which clears any stale message.
  useEffect(() => {
    setStatus(null);
  }, [phase]);

  const handleAdvance = useCallback(async () => {
    setPending(true);
    setStatus(null);
    try {
      const result = await sendAction("leadAdvanceTimedPhase", {
        armedPhase: phase,
      });
      if (!result.changed) {
        setStatus("Nothing to advance — this phase already moved on.");
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not advance.");
    } finally {
      setPending(false);
    }
  }, [sendAction, phase]);

  return (
    <div className="mx-auto mt-2 w-full max-w-md px-5 pb-10">
      <p className="text-center font-mono text-[10px] uppercase tracking-widest text-steel-blue">
        Lead controls
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => void handleAdvance()}
        className="mt-3 w-full rounded-md border border-cloud-grey px-5 py-3 font-display text-sm font-semibold text-unmute-navy transition-colors hover:bg-cloud-grey disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Advancing…" : "Advance for everyone"}
      </button>
      {status ? (
        <p
          className="mt-2 text-center font-body text-xs text-signal-red"
          role="status"
        >
          {status}
        </p>
      ) : null}
    </div>
  );
};
