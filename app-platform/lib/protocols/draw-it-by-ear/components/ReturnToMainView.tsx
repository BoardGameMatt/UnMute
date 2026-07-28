"use client";

import type { SessionParticipantRole } from "@/lib/types/database";
import { getLeadDisplayName } from "../engine";
import type { DibeState } from "../types";

type ReturnToMainViewProps = {
  state: DibeState;
  role: SessionParticipantRole;
  sendAction: (type: string, payload: object) => Promise<void>;
};

export const ReturnToMainView = ({
  state,
  role,
  sendAction,
}: ReturnToMainViewProps) => {
  const leadName = getLeadDisplayName(state);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-5 py-12">
      <h1 className="text-center font-display text-2xl font-bold text-unmute-navy">
        Head back to the main room.
      </h1>

      {role === "lead" ? (
        <button
          type="button"
          onClick={() => void sendAction("everyoneBack", {})}
          className="mt-10 w-full rounded-md bg-signal-amber px-5 py-4 font-display text-base font-semibold text-deep-navy transition-colors hover:bg-sunrise-gold"
        >
          Everyone&apos;s back
        </button>
      ) : (
        <p className="mt-8 text-center font-body text-base text-slate">
          Waiting for {leadName ?? "the lead"}.
        </p>
      )}
    </div>
  );
};
