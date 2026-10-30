"use client";

import { useCallback, useState } from "react";
import type { SendActionResult } from "@/components/providers/SessionProvider";
import { getUnstartedTeams } from "../engine";
import type { DibeState } from "../types";

type LeadRoomStartControlProps = {
  state: DibeState;
  sendAction: (type: string, payload: object) => Promise<SendActionResult>;
};

/**
 * Lead-only recovery for a breakout room whose describer never pressed Go.
 * Fires the same room start the describer would have.
 */
export const LeadRoomStartControl = ({
  state,
  sendAction,
}: LeadRoomStartControlProps) => {
  const [pendingTeamId, setPendingTeamId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const unstarted = getUnstartedTeams(state);
  const armedPhase = state.phase;

  const handleStartRoom = useCallback(
    async (teamId: string) => {
      setPendingTeamId(teamId);
      setStatus(null);
      try {
        const result = await sendAction("leadStartBreakoutRound", {
          teamId,
          armedPhase,
        });
        if (!result.changed) {
          setStatus("That room already started.");
        }
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "Could not start that room.");
      } finally {
        setPendingTeamId(null);
      }
    },
    [sendAction, armedPhase]
  );

  if (unstarted.length === 0) return null;

  return (
    <div className="mx-auto mt-2 w-full max-w-md px-5 pb-10">
      <p className="text-center font-mono text-[10px] uppercase tracking-widest text-steel-blue">
        Lead controls — rooms not started
      </p>
      <ul className="mt-3 space-y-2">
        {unstarted.map((team) => (
          <li key={team.id}>
            <button
              type="button"
              disabled={pendingTeamId === team.id}
              onClick={() => void handleStartRoom(team.id)}
              className="flex w-full items-center justify-between rounded-md border border-cloud-grey px-4 py-3 font-display text-sm font-semibold text-unmute-navy transition-colors hover:bg-cloud-grey disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>{team.name}</span>
              <span className="font-body text-xs text-slate">
                {pendingTeamId === team.id ? "Starting…" : "Start this room"}
              </span>
            </button>
          </li>
        ))}
      </ul>
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
