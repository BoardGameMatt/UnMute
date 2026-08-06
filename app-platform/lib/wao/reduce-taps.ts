/**
 * Reduce append-only wao_taps into two independent selection sets.
 * Spec §7.1: never a shared per-item boolean.
 */

import type { WaoTapAction } from "@/lib/types/database";
import type { WaoSelectionSets } from "./types";

export type ReduceableTap = {
  participant_id: string;
  item_id: string;
  action: WaoTapAction;
  created_at: string;
  client_seq: number;
};

/**
 * Total order for replay:
 * 1. created_at ascending (server timestamp)
 * 2. client_seq ascending (tie-break when two taps share a timestamp)
 * 3. participant_id, then item_id (final deterministic tie-break)
 *
 * client_seq is per (pair, participant), so two different participants can
 * share a timestamp and a seq value; the id tie-break keeps the reduction
 * stable across processes.
 */
export function compareTaps(a: ReduceableTap, b: ReduceableTap): number {
  const ta = Date.parse(a.created_at);
  const tb = Date.parse(b.created_at);
  if (ta !== tb) return ta - tb;
  if (a.client_seq !== b.client_seq) return a.client_seq - b.client_seq;
  const byParticipant = a.participant_id.localeCompare(b.participant_id);
  if (byParticipant !== 0) return byParticipant;
  return a.item_id.localeCompare(b.item_id);
}

function applyAction(set: Set<string>, itemId: string, action: WaoTapAction): void {
  if (action === "select") set.add(itemId);
  else set.delete(itemId);
}

/**
 * Build selection sets for participant A and B from the tap log.
 * Solo pairs pass participantB as null; selectionB stays empty.
 */
export function reduceTaps(
  taps: readonly ReduceableTap[],
  participantA: string,
  participantB: string | null
): WaoSelectionSets {
  const selectionA = new Set<string>();
  const selectionB = new Set<string>();

  const ordered = [...taps].sort(compareTaps);
  for (const tap of ordered) {
    if (tap.participant_id === participantA) {
      applyAction(selectionA, tap.item_id, tap.action);
    } else if (participantB !== null && tap.participant_id === participantB) {
      applyAction(selectionB, tap.item_id, tap.action);
    }
  }

  return {
    selectionA: Array.from(selectionA).sort(),
    selectionB: Array.from(selectionB).sort(),
  };
}

/** Map absolute A/B sets onto the caller's mine/theirs perspective. */
export function perspectiveSelections(
  sets: WaoSelectionSets,
  participantA: string,
  participantB: string | null,
  viewerId: string
): { selectionMine: string[]; selectionTheirs: string[] } {
  if (viewerId === participantA) {
    return {
      selectionMine: sets.selectionA,
      selectionTheirs: sets.selectionB,
    };
  }
  if (participantB !== null && viewerId === participantB) {
    return {
      selectionMine: sets.selectionB,
      selectionTheirs: sets.selectionA,
    };
  }
  return { selectionMine: [], selectionTheirs: [] };
}
