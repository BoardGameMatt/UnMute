"use client";

import { useState } from "react";
import type { Assignment, BuildingView } from "../types";

type BuildingTrayProps = {
  buildings: BuildingView[];
  assignment: Assignment;
  disabled?: boolean;
  heldId: string | null;
  onHold: (buildingId: string | null) => void;
};

export function BuildingTray({
  buildings,
  assignment,
  disabled,
  heldId,
  onHold,
}: BuildingTrayProps) {
  const placedIds = new Set(Object.values(assignment));
  const tray = buildings.filter((b) => !placedIds.has(b.id));
  const [pressing, setPressing] = useState<string | null>(null);

  if (tray.length === 0 && !heldId) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap justify-center gap-2">
        {tray.map((building) => (
          <button
            key={building.id}
            type="button"
            disabled={disabled}
            draggable={!disabled}
            onDragStart={(event) => {
              event.dataTransfer.setData("text/plain", building.id);
              event.dataTransfer.effectAllowed = "move";
              onHold(building.id);
            }}
            onDragEnd={() => onHold(null)}
            onPointerDown={() => setPressing(building.id)}
            onPointerUp={() => setPressing(null)}
            onPointerCancel={() => setPressing(null)}
            onClick={() => onHold(heldId === building.id ? null : building.id)}
            className={`rounded-md border bg-warm-white px-3 py-2 font-display text-sm text-unmute-navy ${
              heldId === building.id || pressing === building.id
                ? "border-2 border-signal-amber"
                : "border-unmute-navy/20"
            }`}
          >
            {building.name}
          </button>
        ))}
      </div>
      {heldId ? (
        <p className="text-center font-body text-xs text-slate">
          Now tap the lot you want to put it in.
        </p>
      ) : (
        <p className="text-center font-body text-xs text-slate">
          Tap the building that you want to place, then tap the lot. Tap the name on a lot to take a
          building back.
        </p>
      )}
    </div>
  );
}
