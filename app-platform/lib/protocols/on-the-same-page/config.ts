/**
 * Piece fills are the spec's palette opt-out. Interface chrome stays on tokens.
 * Shared-screen tiles always use indigo.
 */

export const PIECE_COLORS = ["indigo", "cyan", "green", "sand", "rose"] as const;
export type PieceColor = (typeof PIECE_COLORS)[number];

export const PIECE_FILL: Record<PieceColor, string> = {
  indigo: "#332288",
  cyan: "#88CCEE",
  green: "#117733",
  sand: "#DDCC77",
  rose: "#CC6677",
};

export const PIECE_OUTLINE = "#4D4D4D";
export const SHARED_PIECE_COLOR: PieceColor = "indigo";

export const TILE_IDS = [
  "square",
  "tri_ll",
  "tri_lr",
  "tri_ul",
  "tri_ur",
  "porthole",
  "half_bottom",
  "half_top",
  "half_left",
  "half_right",
] as const;
export type TileId = (typeof TILE_IDS)[number];

export const REACTION_KINDS = ["with_you", "not_sure", "lost", "see_it"] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];

export const OTSP = {
  minPlayers: 8,
  maxPlayers: 16,
  placers: 5,
  expectedRounds: 3,
  dealMs: 20_000,
  checkinMs: 60_000,
  finalLockMs: 15_000,
  graceMs: 2_000,
  reactionGapMs: 2_000,
  turnAmberSeconds: 5,
  checkinAmberSeconds: 15,
  numericSeconds: 3,
  revealMs: {
    suspicion: 6_000,
    improviser: 5_000,
    guess: 5_000,
    picture: 6_000,
    outcome: 0,
  },
} as const;

export function turnMs(roundNumber: number): number {
  return roundNumber <= 1 ? 15_000 : 10_000;
}

export function isTileId(value: unknown): value is TileId {
  return typeof value === "string" && (TILE_IDS as readonly string[]).includes(value);
}

export function isReactionKind(value: unknown): value is ReactionKind {
  return typeof value === "string" && (REACTION_KINDS as readonly string[]).includes(value);
}

export const BRIDGE_LINE =
  "In the game, the Builders couldn't say what the picture was. At work, you can. Where are we acting like we can't?";

export const REFLECTION_PROMPT_1 =
  "Where do we assume we’re on the same page about what is “good” without saying it out loud?";
export const REFLECTION_PROMPT_2 =
  "When a teammate's work doesn't seem to fit the picture, do you tend to stay quiet or speak up? What enables you (or might enable you) to voice your concerns?";
export const REFLECTION_PROMPT_3 = BRIDGE_LINE;
export const REFLECTION_PROMPT_4 =
  "Suspicion often landed on someone doing their part. How do we check our read of a situation (or another team member) before we act on it?";
