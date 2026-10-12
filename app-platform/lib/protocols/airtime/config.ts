export type TreasureCard = {
  id: string;
  level: number;
  name: string;
  value: number;
};

const card = (level: number, name: string, value: number): TreasureCard => ({
  id: `l${level}-${name
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`,
  level,
  name,
  value,
});

export const TREASURE_DECK: readonly TreasureCard[] = [
  card(1, "Lost flip-flop", 0),
  card(1, "Tangled fishing line", 0),
  card(1, "Scallop shell", 1),
  card(1, "Piece of sea glass", 1),
  card(1, "Pair of sunglasses", 2),
  card(1, "Message in a bottle", 2),
  card(2, "Conch shell", 2),
  card(2, "Ship's spoon", 2),
  card(2, "Brass key", 3),
  card(2, "Pewter cup", 3),
  card(2, "Stoneware jug", 3),
  card(2, "Old brass compass", 4),
  card(2, "Barnacle-covered ship's bell", 4),
  card(3, "Captain's logbook", 4),
  card(3, "Ship's lantern", 5),
  card(3, "Pocket watch", 6),
  card(3, "Silver locket", 6),
  card(3, "Sextant", 7),
  card(4, "Pouch of silver coins", 6),
  card(4, "Bronze figurine", 7),
  card(4, "Gold ring", 8),
  card(4, "Jade pendant", 8),
  card(4, "Pearl necklace", 9),
  card(4, "Navigator's astrolabe", 10),
  card(5, "Silver candelabra", 10),
  card(5, "Pearl-inlaid music box", 11),
  card(5, "Handful of gold doubloons", 12),
  card(5, "Emerald brooch", 13),
  card(5, "Ruby ring", 14),
  card(5, "Admiral's medal of honor", 15),
  card(6, "Black pearl", 17),
  card(6, "Bar of sunken bullion", 18),
  card(6, "Queen's tiara", 20),
  card(6, "Diamond necklace", 21),
  card(6, "Chest of gold coins", 21),
  card(6, "Royal jeweled crown", 23),
];

const CARD_BY_ID = new Map(TREASURE_DECK.map((c) => [c.id, c]));

export function cardById(id: string): TreasureCard | undefined {
  return CARD_BY_ID.get(id);
}

export const AIRTIME_CONFIG = {
  airPerDiver: 4,
  airBase: 11,
  /** Air per underwater diver per turn at levels 1–6. */
  airByDepth: [1, 1, 1, 2, 2, 3] as readonly number[],
  maxDepth: 6,
  turnSeconds: 22,
  resultBeatSeconds: 2,
  /** Server waits this long past the visible deadline for taps still in flight. */
  lateChoiceGraceSeconds: 4,
  rulesSeconds: 60,
  maxTurnsPerDive: 14,
  maxDives: 5,
  maxBoatSize: 4,
  minPlayers: 2,
  maxPlayers: 16,
  boatNames: ["Calypso", "Nautilus", "RV Belafonte", "Jenny"] as readonly string[],
  rivalName: "The Orca",
  /** Percent of starting tank: above plenty → Plenty, ≥ half → Half, ≥ low → Low, else Critical. */
  gaugeBands: { plenty: 60, half: 35, low: 15 },
  timeoutChoice: "up" as const,
  /** The rival boat scores a uniform whole number in this range each dive (mean 11.5). */
  rivalScoreMin: 10,
  rivalScoreMax: 13,
  endBannerSeconds: 5,
  /** Units on the progress bar: rules, dive 1, dive 2, final. */
  progressUnits: 4,
};

export type AirtimeConfig = typeof AIRTIME_CONFIG;
