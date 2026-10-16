import { AIRTIME_CONFIG } from "../config";
import type { CrewView, HaulRow } from "../types";
import { BANNER, Banner } from "./AirtimeChrome";
import { AirtimeItemCard } from "./AirtimeItemCard";
import { AirtimeO2Cost } from "./AirtimeO2Icon";

/** Consecutive depths with the same drain, e.g. "Levels 1–3". */
const AIR_TIERS: { label: string; amount: number }[] = AIRTIME_CONFIG.airByDepth.reduce<
  { from: number; to: number; amount: number }[]
>((tiers, amount, i) => {
  const last = tiers[tiers.length - 1];
  if (last && last.amount === amount) last.to = i + 1;
  else tiers.push({ from: i + 1, to: i + 1, amount });
  return tiers;
}, []).map((t) => ({
  label: t.from === t.to ? `Level ${t.from}` : `Levels ${t.from}–${t.to}`,
  amount: t.amount,
}));

type Props = {
  crew: CrewView;
  myResult: HaulRow | null;
  meId: string | null;
};

export function AirtimeCrewView({ crew, myResult, meId }: Props) {
  const short = crew.margin < 0;
  return (
    <div className="space-y-5">
      <Banner>{BANNER.crew}</Banner>

      <div className="rounded-lg border border-cloud-grey bg-warm-white p-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">Oxygen tank</p>
        <p className="mt-1 font-display text-5xl font-bold text-unmute-navy">{crew.tank}</p>
        <p className="font-body text-sm text-slate">of {crew.tankStart} at the start of this dive</p>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-cloud-grey pt-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">Air needed now</p>
            <p className="font-display text-2xl font-semibold text-unmute-navy">{crew.airNeeded}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">Margin</p>
            <p className={`font-display text-2xl font-semibold ${short ? "text-signal-red" : "text-unmute-navy"}`}>
              {crew.margin}
            </p>
          </div>
        </div>
        {short ? (
          <p className="mt-2 font-body text-sm text-signal-red">Not enough air to bring everyone up</p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-lg border border-cloud-grey">
        <table className="w-full text-left">
          <thead className="bg-cloud-grey/60">
            <tr className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
              <th className="px-4 py-2 font-normal">Diver</th>
              <th className="px-2 py-2 text-right font-normal">Depth</th>
              <th className="px-2 py-2 text-right font-normal">Air/turn</th>
              <th className="px-4 py-2 text-right font-normal">To surface</th>
            </tr>
          </thead>
          <tbody>
            {crew.rows.map((r) => (
              <tr key={r.participantId} className="border-t border-cloud-grey font-body text-base text-charcoal">
                <td className="px-4 py-3">
                  {r.displayName}
                  {r.participantId === meId ? <span className="ml-1 text-slate">(you)</span> : null}
                </td>
                {r.status === "underwater" ? (
                  <>
                    <td className="px-2 py-3 text-right font-mono">{r.depth}</td>
                    <td className="px-2 py-3 text-right text-unmute-navy">
                      <AirtimeO2Cost amount={r.airPerTurn} className="justify-end" />
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{r.airToSurface}</td>
                  </>
                ) : (
                  <td colSpan={3} className="px-4 py-3 text-right font-mono text-sm text-slate">
                    On the surface
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-cloud-grey bg-cloud-grey/30 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">Air per diver, each turn</p>
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-body text-sm text-charcoal">
            {AIR_TIERS.map((t) => (
              <li key={t.label} className="inline-flex items-center gap-2">
                <span>{t.label}</span>
                <AirtimeO2Cost amount={t.amount} className="text-unmute-navy" />
              </li>
            ))}
          </ul>
        </div>
      </div>

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
            compact
          />
        </div>
      ) : null}
    </div>
  );
}
