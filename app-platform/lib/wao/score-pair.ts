/**
 * Pure WAO scoring (spec §3). No I/O. Lock It In bonus withdrawn in v1.
 */

import type { WaoRevealBuckets, WaoRevealItem } from "./types";

export const ELIMINATION_CURVE = [0, 1, 3, 6, 10, 15] as const;

/** Triangular through 5, then +5 per additional wrong eliminated. */
export function eliminationCurveScore(wrongEliminatedCount: number): number {
  if (wrongEliminatedCount <= 0) return 0;
  if (wrongEliminatedCount < ELIMINATION_CURVE.length) {
    return ELIMINATION_CURVE[wrongEliminatedCount]!;
  }
  return 15 + (wrongEliminatedCount - 5) * 5;
}

function toCorrectSet(
  correctItemIds: ReadonlySet<string> | readonly string[]
): ReadonlySet<string> {
  return correctItemIds instanceof Set
    ? correctItemIds
    : new Set(correctItemIds);
}

/**
 * Score one elimination set under the zero rule.
 * Any correct (belonging) item in the set → 0. Otherwise curve on count.
 */
export function scoreEliminationSet(
  submittedIds: readonly string[],
  correctItemIds: ReadonlySet<string> | readonly string[]
): number {
  const correct = toCorrectSet(correctItemIds);
  if (submittedIds.some((id) => correct.has(id))) return 0;
  return eliminationCurveScore(submittedIds.length);
}

export function intersectionSorted(
  a: readonly string[],
  b: readonly string[]
): string[] {
  const bSet = new Set(b);
  return a.filter((id) => bSet.has(id)).sort();
}

export function setsEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((id, i) => id === sortedB[i]);
}

export type ScorePairInput = {
  selectionA: readonly string[];
  selectionB: readonly string[];
  isSolo: boolean;
  correctItemIds: ReadonlySet<string> | readonly string[];
  /** Required for paired rounds so Save can name who declined. */
  participantA?: string;
  participantB?: string | null;
};

export type ScorePairOutcome = {
  submittedItemIds: string[];
  /** Awarded score; already halved (floor) when isSolo. */
  score: number;
  /** Always 0 in v1 — Lock It In withdrawn. */
  bonus: 0;
  lott: number;
  /**
   * True when saverParticipantId is set. Kept for the had_save column and
   * callers that only need the flag.
   */
  hadSave: boolean;
  /** Participant who declined a correct item the partner alone had tapped. */
  saverParticipantId: string | null;
  exactMatch: boolean;
};

/**
 * Full pair outcome from final selection sets + answer key.
 * submitted = intersection (or A's set alone when solo).
 */
export function scorePair(input: ScorePairInput): ScorePairOutcome {
  const correct = toCorrectSet(input.correctItemIds);
  const selectionA = [...input.selectionA].sort();
  const selectionB = [...input.selectionB].sort();

  const submittedItemIds = input.isSolo
    ? selectionA
    : intersectionSorted(selectionA, selectionB);

  const rawScore = scoreEliminationSet(submittedItemIds, correct);
  const score = input.isSolo ? Math.floor(rawScore / 2) : rawScore;

  if (input.isSolo) {
    return {
      submittedItemIds,
      score,
      bonus: 0,
      lott: 0,
      hadSave: false,
      saverParticipantId: null,
      exactMatch: false,
    };
  }

  const participantA = input.participantA;
  const participantB = input.participantB;
  if (!participantA || !participantB) {
    throw new Error(
      "scorePair requires participantA and participantB for paired rounds"
    );
  }

  const aSet = new Set(selectionA);
  const bSet = new Set(selectionB);
  const soloWrong: string[] = [];
  /** Saver per solo-tapped correct item; sorted by item id for stability. */
  const saveEvents: { itemId: string; saverId: string }[] = [];

  for (const id of selectionA) {
    if (bSet.has(id)) continue;
    if (correct.has(id)) {
      // A tapped a belonger; B declined → B is the saver.
      saveEvents.push({ itemId: id, saverId: participantB });
    } else {
      soloWrong.push(id);
    }
  }
  for (const id of selectionB) {
    if (aSet.has(id)) continue;
    if (correct.has(id)) {
      saveEvents.push({ itemId: id, saverId: participantA });
    } else {
      soloWrong.push(id);
    }
  }

  saveEvents.sort((left, right) =>
    left.itemId < right.itemId ? -1 : left.itemId > right.itemId ? 1 : 0
  );
  const saverParticipantId = saveEvents[0]?.saverId ?? null;

  const lottSet = Array.from(
    new Set([...submittedItemIds, ...soloWrong])
  ).sort();
  const lott = Math.max(
    0,
    scoreEliminationSet(lottSet, correct) -
      scoreEliminationSet(submittedItemIds, correct)
  );

  return {
    submittedItemIds,
    score,
    bonus: 0,
    lott,
    hadSave: saverParticipantId !== null,
    saverParticipantId,
    exactMatch: setsEqual(selectionA, selectionB),
  };
}

export type RevealItem = WaoRevealItem;
export type RevealBuckets = WaoRevealBuckets;

/**
 * Four reveal buckets (spec §4.2), from the viewer's perspective.
 * "Right" means a correct elimination (item is actually wrong / !isCorrect).
 */
export function buildRevealBuckets(args: {
  selectionMine: readonly string[];
  selectionTheirs: readonly string[];
  isSolo: boolean;
  items: readonly { id: string; label: string; isCorrect: boolean }[];
}): RevealBuckets {
  const byId = new Map(args.items.map((item) => [item.id, item]));
  const mine = new Set(args.selectionMine);
  const theirs = new Set(args.selectionTheirs);

  const bothCorrectElimination: WaoRevealItem[] = [];
  const bothButBelonged: WaoRevealItem[] = [];
  const onlyYouRight: WaoRevealItem[] = [];
  const onlyPartnerRight: WaoRevealItem[] = [];
  const bothIds = args.isSolo
    ? args.selectionMine
    : intersectionSorted(args.selectionMine, args.selectionTheirs);

  for (const id of bothIds) {
    const item = byId.get(id);
    if (!item) continue;
    const entry = { id: item.id, label: item.label };
    if (item.isCorrect) bothButBelonged.push(entry);
    else bothCorrectElimination.push(entry);
  }

  if (!args.isSolo) {
    for (const id of args.selectionMine) {
      if (theirs.has(id)) continue;
      const item = byId.get(id);
      if (!item || item.isCorrect) continue;
      onlyYouRight.push({ id: item.id, label: item.label });
    }
    for (const id of args.selectionTheirs) {
      if (mine.has(id)) continue;
      const item = byId.get(id);
      if (!item || item.isCorrect) continue;
      onlyPartnerRight.push({ id: item.id, label: item.label });
    }
  }

  return {
    bothCorrectElimination,
    bothButBelonged,
    onlyYouRight,
    onlyPartnerRight,
  };
}
