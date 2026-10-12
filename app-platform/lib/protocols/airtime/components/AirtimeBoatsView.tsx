"use client";

import type { AirtimePlayState } from "../types";
import { BoatCard, ProtocolLabel } from "./AirtimeChrome";

export function AirtimeBoatsView({ state }: { state: AirtimePlayState }) {
  const myBoat = state.boats.find((b) => b.id === state.myBoatId) ?? null;

  return (
    <div className="space-y-6">
      <ProtocolLabel />
      {myBoat ? (
        <BoatCard name={myBoat.name} members={myBoat.members} me={state.me?.participantId} />
      ) : (
        <p className="font-body text-base text-slate">You&apos;re watching this one.</p>
      )}
      <p className="font-body text-base text-slate">The facilitator will start the first dive.</p>
    </div>
  );
}
