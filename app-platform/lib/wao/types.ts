/**
 * Shared WAO play types. Keep free of React and of Supabase clients.
 */

import type { WaoLockReason, WaoTapAction as DbTapAction } from "@/lib/types/database";

export const WAO_SETTLE_SECONDS = 3;

export type WaoTapAction = DbTapAction;

export type WaoItemVisualState = "unselected" | "mine" | "theirs" | "both";

/** Public item shape — never includes is_correct during play. */
export type WaoPublicItem = {
  id: string;
  label: string;
};

export type WaoSelectionSets = {
  selectionA: string[];
  selectionB: string[];
};

export type WaoPairPlayState = {
  pairId: string;
  roundId: string;
  sessionId: string;
  waoSessionId: string;
  questionId: string;
  categoryTitle: string;
  disambiguationRule: string;
  disambiguationDetail: string | null;
  timerSeconds: number;
  startedAt: string | null;
  lockedAt: string | null;
  lockReason: WaoLockReason | null;
  isSolo: boolean;
  participantA: string;
  participantB: string | null;
  myParticipantId: string;
  partnerParticipantId: string | null;
  myDisplayName: string;
  partnerDisplayName: string | null;
  myLockedAt: string | null;
  partnerLockedAt: string | null;
  items: WaoPublicItem[];
  selectionMine: string[];
  selectionTheirs: string[];
  channel: string;
};

export type WaoBroadcastTapPayload = {
  type: "tap";
  pairId: string;
  tap: {
    participantId: string;
    itemId: string;
    action: WaoTapAction;
    clientSeq: number;
    createdAt: string;
  };
  selectionA: string[];
  selectionB: string[];
};

export type WaoBroadcastLockPayload = {
  type: "lock";
  pairId: string;
  participantId: string;
  lockedAAt: string | null;
  lockedBAt: string | null;
  lockedAt: string | null;
  lockReason: WaoLockReason | null;
};

export type WaoBroadcastPayload = WaoBroadcastTapPayload | WaoBroadcastLockPayload;

export function waoPairChannelName(roundId: string, pairId: string): string {
  return `wao:${roundId}:${pairId}`;
}

export function deriveItemState(
  itemId: string,
  selectionMine: ReadonlySet<string> | readonly string[],
  selectionTheirs: ReadonlySet<string> | readonly string[]
): WaoItemVisualState {
  const mineHas =
    selectionMine instanceof Set
      ? selectionMine.has(itemId)
      : (selectionMine as readonly string[]).includes(itemId);
  const theirsHas =
    selectionTheirs instanceof Set
      ? selectionTheirs.has(itemId)
      : (selectionTheirs as readonly string[]).includes(itemId);
  if (mineHas && theirsHas) return "both";
  if (mineHas) return "mine";
  if (theirsHas) return "theirs";
  return "unselected";
}
