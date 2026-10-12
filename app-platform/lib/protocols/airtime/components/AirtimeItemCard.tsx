"use client";

import { useEffect, useState } from "react";

export type ItemCardState = "underwater" | "surfaced" | "lost" | "forfeit";

type Props = {
  itemId: string | null;
  name: string;
  level: number;
  /** Null renders `?` (value hidden while underwater). */
  value: number | null;
  state: ItemCardState;
  /** Value a lost/forfeit diver gave up, shown struck through. */
  lostValue?: number | null;
  compact?: boolean;
  /** Omit the value column entirely (lobby explainer). */
  hideValue?: boolean;
};

const LEVEL_SURFACE: Record<number, string> = {
  1: "bg-warm-white border-cloud-grey",
  2: "bg-cloud-grey border-cloud-grey",
  3: "bg-steel-blue/20 border-steel-blue/30",
  4: "bg-steel-blue border-steel-blue",
  5: "bg-unmute-navy border-unmute-navy",
  6: "bg-deep-navy border-sunrise-gold border-2",
};

function iconUrl(itemId: string): string {
  return `/protocols/airtime/items/${itemId}.svg`;
}

/** Resolves true once the icon file loads; false if it is missing. */
function useIconAvailable(itemId: string | null): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (!itemId) {
      setOk(false);
      return;
    }
    let live = true;
    const img = new Image();
    img.onload = () => live && setOk(true);
    img.onerror = () => live && setOk(false);
    img.src = iconUrl(itemId);
    return () => {
      live = false;
    };
  }, [itemId]);
  return ok;
}

export function ItemGlyph({
  itemId,
  level,
  dark,
  muted,
  sizeClass = "h-12 w-12",
}: {
  itemId: string | null;
  level: number;
  dark: boolean;
  muted?: boolean;
  sizeClass?: string;
}) {
  const available = useIconAvailable(itemId);
  const tint = muted ? "bg-slate" : dark ? "bg-warm-white" : "bg-unmute-navy";
  if (!itemId || !available) {
    return (
      <span
        className={`flex ${sizeClass} items-center justify-center rounded-full border ${
          dark ? "border-warm-white/60 text-warm-white" : "border-unmute-navy/30 text-unmute-navy"
        } font-mono text-sm`}
        aria-hidden="true"
      >
        L{level}
      </span>
    );
  }
  const url = `url(${iconUrl(itemId)})`;
  return (
    <span
      className={`block ${sizeClass} ${tint}`}
      style={{
        maskImage: url,
        WebkitMaskImage: url,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
      aria-hidden="true"
    />
  );
}

export function AirtimeItemCard({ itemId, name, level, value, state, lostValue, compact, hideValue }: Props) {
  const gone = state === "lost" || state === "forfeit";
  const dark = level >= 4 && !gone;
  const surface = gone
    ? "bg-warm-white border-dashed border-slate/60 border-2"
    : `${LEVEL_SURFACE[level] ?? LEVEL_SURFACE[1]} border`;
  const text = dark ? "text-warm-white" : "text-unmute-navy";
  const sub = dark ? "text-warm-white/80" : "text-steel-blue";

  return (
    <div
      className={`relative rounded-lg ${surface} ${compact ? "p-4" : "p-6"}`}
      aria-label={`${name}, level ${level}${value === null ? ", value hidden" : `, value ${value}`}`}
    >
      <div className="flex items-center gap-4">
        <ItemGlyph
          itemId={itemId}
          level={level}
          dark={dark}
          muted={gone}
          sizeClass={compact ? "h-10 w-10" : "h-12 w-12"}
        />
        <div className="min-w-0 flex-1">
          <p className={`font-mono text-[10px] uppercase tracking-widest ${sub}`}>L{level}</p>
          <p className={`font-display ${compact ? "text-base" : "text-lg"} font-semibold leading-snug ${gone ? "text-slate" : text}`}>
            {name}
          </p>
        </div>
        <div className={`text-right ${hideValue ? "hidden" : ""}`}>
          {state === "underwater" ? (
            <p className={`font-display text-3xl font-bold ${text}`}>?</p>
          ) : state === "surfaced" ? (
            <p className={`font-display text-3xl font-bold ${text}`}>
              {value ?? 0}
              <span className="ml-1 align-middle font-body text-base" aria-hidden="true">
                ✓
              </span>
            </p>
          ) : (
            <div>
              <p className="font-display text-3xl font-bold text-slate">0</p>
              {lostValue !== null && lostValue !== undefined ? (
                <p className="font-mono text-xs text-slate line-through">{lostValue}</p>
              ) : null}
            </div>
          )}
        </div>
      </div>
      {gone ? (
        <p
          className={`mt-3 font-mono text-[11px] uppercase tracking-widest ${
            state === "lost" ? "text-signal-red" : "text-steel-blue"
          }`}
        >
          {state === "lost" ? "Lost" : "Forfeit"}
        </p>
      ) : null}
    </div>
  );
}
