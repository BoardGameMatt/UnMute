export {
  assignPairs,
  pairKey,
  type AssignedPair,
  type PairHistory,
  type Pairing,
  type RoundAssignment,
  type RoundAssignmentFailure,
  type RoundAssignmentSuccess,
} from "./assign-pairs";

export {
  compareTaps,
  perspectiveSelections,
  reduceTaps,
  type ReduceableTap,
} from "./reduce-taps";

export {
  buildRevealBuckets,
  eliminationCurveScore,
  scoreEliminationSet,
  scorePair,
  type ScorePairInput,
  type ScorePairOutcome,
} from "./score-pair";

export {
  deriveItemState,
  waoPairChannelName,
  WAO_SETTLE_SECONDS,
  type WaoBroadcastPayload,
  type WaoItemVisualState,
  type WaoPairPlayState,
  type WaoPublicItem,
  type WaoRevealBuckets,
  type WaoRevealItem,
  type WaoRevealState,
  type WaoSelectionSets,
  type WaoTapAction,
} from "./types";

// authorize-pair and broadcast import "server-only" — import them from their
// own modules in Route Handlers, never from this barrel.
