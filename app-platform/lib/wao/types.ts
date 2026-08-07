/**
 * Shared WAO play types. Keep free of React and of Supabase clients.
 */

import type { WaoLockReason, WaoTapAction as DbTapAction } from "@/lib/types/database";

export const WAO_SETTLE_SECONDS = 3;
/** Authoritative play duration written onto new wao_sessions rows. */
export const WAO_ROUND_SECONDS = 60;

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
  /** Round close (timer only in v1). */
  lockedAt: string | null;
  lockReason: WaoLockReason | null;
  isSolo: boolean;
  participantA: string;
  participantB: string | null;
  myParticipantId: string;
  partnerParticipantId: string | null;
  myDisplayName: string;
  partnerDisplayName: string | null;
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

export type WaoBroadcastRoundLockedPayload = {
  type: "round_locked";
  pairId: string;
  lockedAt: string | null;
  lockReason: WaoLockReason | null;
};

export type WaoBroadcastPayload =
  | WaoBroadcastTapPayload
  | WaoBroadcastRoundLockedPayload;

/** Reveal item — label only; is_correct is never sent as a field. */
export type WaoRevealItem = {
  id: string;
  label: string;
};

export type WaoRevealBuckets = {
  bothCorrectElimination: WaoRevealItem[];
  bothButBelonged: WaoRevealItem[];
  onlyYouRight: WaoRevealItem[];
  onlyPartnerRight: WaoRevealItem[];
};

/** Post-lock reveal payload for one pair member. */
export type WaoRevealState = {
  pairId: string;
  roundId: string;
  sessionId: string;
  roundNumber: number;
  categoryTitle: string;
  disambiguationRule: string;
  disambiguationDetail: string | null;
  isSolo: boolean;
  myDisplayName: string;
  partnerDisplayName: string | null;
  score: number;
  bonus: number;
  lott: number;
  hadSave: boolean;
  exactMatch: boolean;
  submittedItemIds: string[];
  buckets: WaoRevealBuckets;
};

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
