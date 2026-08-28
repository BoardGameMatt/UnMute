"use client";

import type { Cell, LetteredLot, OccupiedCellView } from "../types";

export type LotMark = "hit" | "miss";

type CityMapProps = {
  occupied: OccupiedCellView[];
  legalLots: Cell[];
  selectedLots: Cell[];
  lots: LetteredLot[];
  lotNames?: Record<string, string>;
  lotGuessNames?: Record<string, string>;
  lotMarks?: Record<string, LotMark>;
  canPick: boolean;
  canPlace?: boolean;
  heldBuildingId?: string | null;
  onToggle?: (cell: Cell) => void;
  onPlaceLetter?: (letter: string, buildingId?: string) => void;
  onReturnLetter?: (letter: string) => void;
};

function key(col: number, row: number) {
  return `${col},${row}`;
}

export function CityMap({
  occupied,
  legalLots,
  selectedLots,
  lots,
  lotNames,
  lotGuessNames,
  lotMarks,
  canPick,
  canPlace,
  heldBuildingId,
  onToggle,
  onPlaceLetter,
  onReturnLetter,
}: CityMapProps) {
  const occ = new Map(occupied.map((c) => [key(c.col, c.row), c]));
  const legal = new Set(legalLots.map((c) => key(c.col, c.row)));
  const selected = new Set(selectedLots.map((c) => key(c.col, c.row)));
  const lettered = new Map(lots.map((l) => [key(l.col, l.row), l.letter]));

  return (
    <div className="mx-auto grid max-w-sm grid-cols-5 gap-1">
      {Array.from({ length: 35 }, (_, i) => {
        const col = i % 5;
        const row = Math.floor(i / 5);
        const k = key(col, row);
        const cell = occ.get(k);
        const isLegal = legal.has(k);
        const isSelected = selected.has(k);
        const letter = lettered.get(k);
        const mark = letter ? lotMarks?.[letter] : undefined;
        const dropReady = Boolean(canPlace && letter && heldBuildingId);

        let className =
          "relative flex aspect-square min-h-[3rem] flex-col items-center justify-center rounded-md border px-0.5 text-center";
        if (cell?.kind === "hall") {
          className += " border-unmute-navy bg-unmute-navy text-warm-white";
        } else if (cell?.kind === "building") {
          className += " border-unmute-navy/40 bg-warm-white text-unmute-navy";
        } else if (letter) {
          className += dropReady
            ? " border-2 border-signal-amber bg-warm-white"
            : " border-2 border-unmute-navy bg-warm-white";
        } else if (isSelected) {
          className += " border-2 border-unmute-navy bg-unmute-navy/5";
        } else if (isLegal) {
          className += " border-2 border-dashed border-unmute-navy bg-cloud-grey/70";
        } else {
          className += " border-cloud-grey bg-warm-white";
        }

        const interactivePick = canPick && isLegal;
        const interactivePlace = Boolean(canPlace && letter);

        return (
          <button
            key={k}
            type="button"
            disabled={!interactivePick && !interactivePlace}
            onClick={() => {
              if (interactivePick) onToggle?.({ col, row });
              else if (letter && heldBuildingId) onPlaceLetter?.(letter);
              else if (letter && lotNames?.[letter]) onReturnLetter?.(letter);
            }}
            onDragOver={(event) => {
              if (!interactivePlace) return;
              event.preventDefault();
            }}
            onDrop={(event) => {
              if (!letter) return;
              event.preventDefault();
              const dropped = event.dataTransfer.getData("text/plain");
              onPlaceLetter?.(letter, dropped || undefined);
            }}
            className={className}
          >
            {cell?.kind === "hall" ? (
              <span className="font-mono text-[7px] font-medium uppercase leading-tight tracking-wider sm:text-[8px]">
                City
                <br />
                Hall
              </span>
            ) : cell?.kind === "building" ? (
              <span className="font-display text-[9px] font-semibold leading-tight">{cell.name}</span>
            ) : letter ? (
              <span className="flex flex-col items-center">
                <span className="font-display text-base font-semibold text-unmute-navy sm:text-lg">
                  {letter}
                </span>
                {lotNames?.[letter] ? (
                  <span className="font-display text-[8px] font-medium leading-tight text-charcoal">
                    {lotNames[letter]}
                  </span>
                ) : (
                  <span className="mt-0.5 h-3.5 w-3.5 rounded-[2px] border border-dashed border-unmute-navy/50" />
                )}
                {mark === "miss" && lotGuessNames?.[letter] && lotGuessNames[letter] !== lotNames?.[letter] ? (
                  <span className="font-body text-[7px] leading-tight text-signal-red">
                    Team: {lotGuessNames[letter]}
                  </span>
                ) : null}
              </span>
            ) : isLegal && canPick ? (
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-[3px] border-2 border-unmute-navy font-mono text-[10px] text-unmute-navy ${
                  isSelected ? "bg-unmute-navy text-warm-white" : "bg-warm-white"
                }`}
              >
                {isSelected ? "✓" : ""}
              </span>
            ) : null}

            {mark === "hit" ? (
              <span
                className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-sunrise-gold font-display text-lg font-bold leading-none text-deep-navy"
                aria-label="Correct"
              >
                ✓
              </span>
            ) : null}
            {mark === "miss" ? (
              <span
                className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-signal-red font-display text-lg font-bold leading-none text-warm-white"
                aria-label="Incorrect"
              >
                ×
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
