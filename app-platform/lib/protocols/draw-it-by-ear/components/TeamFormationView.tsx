"use client";

import type { SessionParticipantRole } from "@/lib/types/database";
import type { DibeState } from "../types";

type TeamFormationViewProps = {
  state: DibeState;
  participantId: string;
  role: SessionParticipantRole;
  sendAction: (type: string, payload: object) => Promise<void>;
};

export const TeamFormationView = ({
  state,
  participantId,
  role,
  sendAction,
}: TeamFormationViewProps) => {
  const myTeam = state.teams.find((t) => t.member_ids.includes(participantId));
  const unassigned = state.participants.filter(
    (p) => !state.teams.some((t) => t.member_ids.includes(p.id))
  );

  return (
    <div className="min-h-[70vh] px-5 py-10">
      <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
        TEAM FORMATION
      </p>
      <h1 className="mt-4 text-center font-display text-2xl font-bold text-unmute-navy">
        Choose your teams
      </h1>

      {state.formation_error ? (
        <p className="mt-4 text-center font-body text-sm text-signal-red" role="alert">
          {state.formation_error}
        </p>
      ) : null}

      {role === "lead" && !state.team_formation_mode ? (
        <div className="mx-auto mt-8 max-w-sm space-y-3">
          <button
            type="button"
            onClick={() => void sendAction("autoAssignTeams", {})}
            className="w-full rounded-md bg-unmute-navy px-5 py-4 font-display text-base font-semibold text-warm-white hover:bg-deep-navy"
          >
            Auto-Assign Teams
          </button>
          <button
            type="button"
            onClick={() => void sendAction("enableSelfSelectTeams", {})}
            className="w-full rounded-md border border-cloud-grey px-5 py-4 font-display text-base font-semibold text-unmute-navy hover:bg-cloud-grey"
          >
            Let People Choose
          </button>
        </div>
      ) : null}

      {state.teams.length > 0 ? (
        <ul className="mx-auto mt-8 max-w-md space-y-4">
          {state.teams.map((team) => (
            <li
              key={team.id}
              className="rounded-lg border border-cloud-grey bg-warm-white p-5 shadow-sm"
              style={{ borderLeftWidth: 4, borderLeftColor: team.color }}
            >
              <p className="font-display text-lg font-semibold text-unmute-navy">{team.name}</p>
              <ul className="mt-3 space-y-1 font-body text-sm text-charcoal">
                {team.member_ids.map((id) => {
                  const p = state.participants.find((x) => x.id === id);
                  return <li key={id}>{p?.display_name ?? "Player"}</li>;
                })}
                {team.member_ids.length === 0 ? (
                  <li className="text-slate">No members yet</li>
                ) : null}
              </ul>
              {state.team_formation_mode === "self_select" && !state.teams_locked ? (
                <button
                  type="button"
                  onClick={() => void sendAction("joinTeam", { participantId, teamId: team.id })}
                  disabled={myTeam?.id === team.id || team.member_ids.length >= 4}
                  className="mt-4 w-full rounded-md border border-cloud-grey py-2 font-display text-sm font-semibold text-unmute-navy hover:bg-cloud-grey disabled:opacity-40"
                >
                  {myTeam?.id === team.id ? "Your team" : "Join team"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {role === "lead" && state.team_formation_mode === "self_select" && unassigned.length > 0 ? (
        <p className="mt-6 text-center font-body text-sm text-signal-red">
          {unassigned.length} participant(s) still need a team.
        </p>
      ) : null}

      {role === "lead" && state.teams.length > 0 ? (
        <button
          type="button"
          onClick={() => void sendAction("lockTeams", {})}
          className="mx-auto mt-10 block w-full max-w-sm rounded-md bg-signal-amber px-5 py-4 font-display text-base font-semibold text-deep-navy hover:bg-sunrise-gold"
        >
          Lock Teams
        </button>
      ) : null}
    </div>
  );
};
