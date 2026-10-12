import { BOAT_ICONS, boatIconId } from "../icon-credits";

function boatMask(name: string): string {
  const id = boatIconId(name);
  return id in BOAT_ICONS ? `url(/protocols/airtime/boats/${id}.svg)` : "url(/protocols/airtime/boat.svg)";
}

/** Boat glyph as a token-tinted CSS mask. */
export function AirtimeBoatIcon({ name, className = "h-14 w-14" }: { name: string; className?: string }) {
  const mask = boatMask(name);
  return (
    <span
      className={`block shrink-0 bg-unmute-navy ${className}`}
      style={{
        maskImage: mask,
        WebkitMaskImage: mask,
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
