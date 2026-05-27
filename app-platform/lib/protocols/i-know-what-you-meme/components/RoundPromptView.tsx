"use client";

import type { SessionParticipantRole } from "@/lib/types/database";
import type { IKWYMState, IKWYMRoundPrompts } from "../types";

type RoundPromptViewProps = {
  state: IKWYMState;
  round: 1 | 2;
  prompts: IKWYMRoundPrompts;
  role: SessionParticipantRole;
  sendAction: (type: string, payload: object) => Promise<void>;
};

export const RoundPromptView = ({
  state,
  round,
  prompts,
  role,
  sendAction,
}: RoundPromptViewProps) => {
  const actionType = round === 1 ? "ikwym/broadcast_round1" : "ikwym/broadcast_round2";

  return (
    <div className="min-h-[70vh] px-5 py-10">
      <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
        I KNOW WHAT YOU MEME
      </p>
      <h1 className="mt-4 text-center font-display text-2xl font-bold text-unmute-navy">
        Round {round} prompts
      </h1>

      <div className="mx-auto mt-8 max-w-md space-y-4">
        <div className="rounded-lg border border-cloud-grey bg-warm-white p-6 shadow-sm">
          <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
            Check-in
          </p>
          <p className="mt-2 font-display text-lg font-medium text-charcoal">
            {prompts.openPrompt}
          </p>
        </div>
        <div className="rounded-lg border border-cloud-grey bg-warm-white p-6 shadow-sm">
          <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
            {prompts.stimulusCategory.label}
          </p>
          <p className="mt-2 font-display text-lg font-medium text-charcoal">
            {prompts.stimulusCategory.prompt}
          </p>
        </div>
      </div>

      {role === "lead" ? (
        <button
          type="button"
          onClick={() => void sendAction(actionType, { role })}
          className="mx-auto mt-10 block w-full max-w-md rounded-md bg-signal-amber px-5 py-4 font-display text-base font-semibold text-deep-navy transition-colors hover:bg-sunrise-gold"
        >
          Send to team
        </button>
      ) : (
        <p className="mt-10 text-center font-body text-sm text-slate">
          Stand by — your lead is sending the prompts to the team.
        </p>
      )}

      <ParticipantChipRoster
        participants={state.participants}
        submittedIds={[]}
        className="mt-8"
      />
    </div>
  );
};

type ParticipantChipRosterProps = {
  participants: IKWYMState["participants"];
  submittedIds: string[];
  className?: string;
};

export const ParticipantChipRoster = ({
  participants,
  submittedIds,
  className = "",
}: ParticipantChipRosterProps) => {
  const submittedSet = new Set(submittedIds);

  return (
    <ul className={`flex flex-wrap justify-center gap-2 ${className}`}>
      {participants.map((p) => {
        const submitted = submittedSet.has(p.id);
        return (
          <li
            key={p.id}
            className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-widest ${
              submitted
                ? "border-unmute-navy bg-unmute-navy text-warm-white"
                : "border-cloud-grey bg-warm-white text-slate"
            }`}
          >
            {p.display_name}
          </li>
        );
      })}
    </ul>
  );
};
