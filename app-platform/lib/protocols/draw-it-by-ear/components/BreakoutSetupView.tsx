"use client";

import type { SessionParticipantRole } from "@/lib/types/database";
import { getActiveDescriberDisplayName, getParticipantTeam } from "../engine";
import type { DibeState } from "../types";

type BreakoutSetupViewProps = {
  state: DibeState;
  participantId: string;
  role: SessionParticipantRole;
  sendAction: (type: string, payload: object) => Promise<void>;
};

export const BreakoutSetupView = ({
  state,
  participantId,
  role,
  sendAction,
}: BreakoutSetupViewProps) => {
  const team = getParticipantTeam(state, participantId);
  const describerName = getActiveDescriberDisplayName(state, participantId);

  return (
    <div className="min-h-[70vh] px-5 py-10">
      <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
        BREAKOUT SETUP
      </p>
      <h1 className="mt-4 text-center font-display text-2xl font-bold text-unmute-navy">
        Head to your breakout room
      </h1>
      {describerName ? (
        <p className="mt-6 text-center font-display text-lg font-semibold text-unmute-navy">
          {describerName} is describing this round.
        </p>
      ) : null}
      {team ? (
        <div
          className="mx-auto mt-8 max-w-sm rounded-lg border border-cloud-grey bg-warm-white p-6 shadow-sm"
          style={{ borderLeftWidth: 4, borderLeftColor: team.color }}
        >
          <p className="font-display text-xl font-semibold text-unmute-navy">{team.name}</p>
          <ul className="mt-4 space-y-1 font-body text-sm text-charcoal">
            {team.member_ids.map((id) => {
              const p = state.participants.find((x) => x.id === id);
              return <li key={id}>{p?.display_name ?? "Player"}</li>;
            })}
          </ul>
          <p className="mt-4 font-body text-sm text-slate">Listen and draw on paper.</p>
        </div>
      ) : (
        <p className="mt-8 text-center font-body text-signal-red">Team not assigned.</p>
      )}
      {role === "lead" ? (
        <button
          type="button"
          onClick={() => void sendAction("startRound", {})}
          className="mx-auto mt-10 block w-full max-w-sm rounded-md bg-signal-amber px-5 py-4 font-display text-base font-semibold text-deep-navy hover:bg-sunrise-gold"
        >
          Start Round
        </button>
      ) : null}
    </div>
  );
};
