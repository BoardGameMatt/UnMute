"use client";

import { useCallback, useState } from "react";
import type { SendActionResult } from "@/components/providers/SessionProvider";
import { getPendingDrawingTeamIds } from "../engine";
import type { DibeState } from "../types";

type LeadEndDrawingControlProps = {
  state: DibeState;
  sendAction: (type: string, payload: object) => Promise<SendActionResult>;
};

/**
 * Lead-only force-end for ROUND_DESCRIBE. Rooms normally end themselves, so
 * this exists for a room that pressed Go and then stalled.
 */
export const LeadEndDrawingControl = ({
  state,
  sendAction,
}: LeadEndDrawingControlProps) => {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const armedPhase = state.phase;
  const stillDrawing = getPendingDrawingTeamIds(state).length;

  const handleEndDrawing = useCallback(async () => {
    setPending(true);
    setStatus(null);
    try {
      const result = await sendAction("leadEndDrawingForAllRooms", {
        armedPhase,
      });
      if (!result.changed) {
        setStatus("Drawing has already ended for all rooms.");
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not end drawing.");
    } finally {
      setPending(false);
    }
  }, [sendAction, armedPhase]);

  return (
    <div className="mx-auto mt-2 w-full max-w-md px-5 pb-10">
      <button
        type="button"
        disabled={pending}
        onClick={() => void handleEndDrawing()}
        className="w-full rounded-md border border-cloud-grey px-5 py-3 font-display text-sm font-semibold text-unmute-navy transition-colors hover:bg-cloud-grey disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Ending…" : "End drawing in every room"}
      </button>
      <p className="mt-2 text-center font-body text-xs text-slate">
        {stillDrawing === 1
          ? "1 room still drawing."
          : `${stillDrawing} rooms still drawing.`}
      </p>
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
