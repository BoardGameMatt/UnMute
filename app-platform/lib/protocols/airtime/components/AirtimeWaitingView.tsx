import type { HaulRow } from "../types";
import { BANNER, Banner } from "./AirtimeChrome";
import { AirtimeItemCard } from "./AirtimeItemCard";

export function AirtimeWaitingView({ myResult }: { myResult: HaulRow | null }) {
  return (
    <div className="space-y-5">
      <Banner>{BANNER.waiting}</Banner>
      {myResult ? (
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">Your haul</p>
          <AirtimeItemCard
            itemId={myResult.itemId}
            name={myResult.itemName}
            level={myResult.level}
            value={myResult.value}
            state={myResult.status}
            lostValue={myResult.lostValue}
          />
          {myResult.status === "lost" ? (
            <p className="font-body text-sm text-slate">
              Your boat ran out of air. You lost this treasure for this dive.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
