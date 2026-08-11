import type { TraneOfferingPhase } from "@/lib/types/database";

const ALLOWED: Record<TraneOfferingPhase, readonly TraneOfferingPhase[]> = {
  waiting: ["pre_open", "closed"],
  pre_open: ["pre_closed", "post_open", "closed"],
  pre_closed: ["post_open", "closed"],
  post_open: ["closed"],
  closed: [],
};

export function canTransitionPhase(
  from: TraneOfferingPhase,
  to: TraneOfferingPhase
): boolean {
  return ALLOWED[from].includes(to);
}

export function responsePhaseForOffering(
  phase: TraneOfferingPhase
): "pre" | "post" | null {
  if (phase === "pre_open") return "pre";
  if (phase === "post_open") return "post";
  return null;
}
