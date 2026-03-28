"use client";

import { useSessionContext, useGameState } from "@/components/providers/SessionProvider";
import type { SessionProtocolProps } from "@/lib/protocols/registry";

const PlaceholderProtocol = ({
  sessionId,
  participantId,
  role,
  teamId,
}: SessionProtocolProps) => {
  const { protocolName } = useSessionContext();
  const { stateJson, phase, currentRound, isLoading } = useGameState();

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <header className="space-y-1 border-b border-cloud-grey pb-4">
        <p className="font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
          Placeholder protocol
        </p>
        <h1 className="font-display text-2xl font-bold text-unmute-navy">{protocolName}</h1>
      </header>

      <dl className="grid gap-3 font-body text-sm text-charcoal sm:grid-cols-2">
        <div className="rounded-lg border border-cloud-grey bg-warm-white p-4 shadow-sm">
          <dt className="font-mono text-xs uppercase tracking-widest text-slate">Session</dt>
          <dd className="mt-1 break-all font-mono text-xs text-charcoal">{sessionId}</dd>
        </div>
        <div className="rounded-lg border border-cloud-grey bg-warm-white p-4 shadow-sm">
          <dt className="font-mono text-xs uppercase tracking-widest text-slate">Participant</dt>
          <dd className="mt-1 break-all font-mono text-xs text-charcoal">{participantId}</dd>
        </div>
        <div className="rounded-lg border border-cloud-grey bg-warm-white p-4 shadow-sm">
          <dt className="font-mono text-xs uppercase tracking-widest text-slate">Role</dt>
          <dd className="mt-1 capitalize">{role}</dd>
        </div>
        <div className="rounded-lg border border-cloud-grey bg-warm-white p-4 shadow-sm">
          <dt className="font-mono text-xs uppercase tracking-widest text-slate">Team</dt>
          <dd className="mt-1 break-all font-mono text-xs text-charcoal">{teamId}</dd>
        </div>
        <div className="rounded-lg border border-cloud-grey bg-warm-white p-4 shadow-sm">
          <dt className="font-mono text-xs uppercase tracking-widest text-slate">Phase</dt>
          <dd className="mt-1">{isLoading ? "…" : phase}</dd>
        </div>
        <div className="rounded-lg border border-cloud-grey bg-warm-white p-4 shadow-sm">
          <dt className="font-mono text-xs uppercase tracking-widest text-slate">Round</dt>
          <dd className="mt-1">{isLoading ? "…" : currentRound}</dd>
        </div>
      </dl>

      <section className="rounded-lg border border-cloud-grey bg-cloud-grey/40 p-4">
        <h2 className="font-mono text-xs font-normal uppercase tracking-widest text-steel-blue">
          state_json
        </h2>
        <pre className="mt-3 max-h-80 overflow-auto font-mono text-xs text-charcoal">
          {isLoading ? "Loading…" : JSON.stringify(stateJson, null, 2)}
        </pre>
      </section>
    </div>
  );
};

export default PlaceholderProtocol;
