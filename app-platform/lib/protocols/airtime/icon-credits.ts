/**
 * game-icons.net (CC BY 3.0) source for every Airtime glyph. `substitute`
 * marks items with no exact icon; the closest glyph is used instead.
 * Regenerate files with `npx tsx scripts/airtime-icons.ts <game-icons checkout>`.
 */

export type IconSource = { author: string; icon: string; substitute?: boolean };

export const ITEM_ICONS: Record<string, IconSource> = {
  "l1-lost-flip-flop": { author: "delapouite", icon: "flip-flops" },
  "l1-tangled-fishing-line": { author: "lorc", icon: "fishing-hook", substitute: true },
  "l1-scallop-shell": { author: "lorc", icon: "scallop" },
  "l1-piece-of-sea-glass": { author: "lorc", icon: "crystal-shine", substitute: true },
  "l1-pair-of-sunglasses": { author: "delapouite", icon: "sunglasses" },
  "l1-message-in-a-bottle": { author: "lorc", icon: "square-bottle", substitute: true },
  "l2-conch-shell": { author: "lorc", icon: "spiral-shell" },
  "l2-ships-spoon": { author: "lorc", icon: "spoon" },
  "l2-brass-key": { author: "lorc", icon: "key" },
  "l2-pewter-cup": { author: "lorc", icon: "beer-stein", substitute: true },
  "l2-stoneware-jug": { author: "delapouite", icon: "jug" },
  "l2-old-brass-compass": { author: "lorc", icon: "compass" },
  "l2-barnacle-covered-ships-bell": { author: "lorc", icon: "ringing-bell" },
  "l3-captains-logbook": { author: "lorc", icon: "book-cover" },
  "l3-ships-lantern": { author: "delapouite", icon: "old-lantern" },
  "l3-pocket-watch": { author: "skoll", icon: "pocket-watch" },
  "l3-silver-locket": { author: "delapouite", icon: "heart-necklace", substitute: true },
  "l3-sextant": { author: "delapouite", icon: "sextant" },
  "l4-pouch-of-silver-coins": { author: "lorc", icon: "swap-bag" },
  "l4-bronze-figurine": { author: "delapouite", icon: "colombian-statue" },
  "l4-gold-ring": { author: "delapouite", icon: "ring" },
  "l4-jade-pendant": { author: "lorc", icon: "gem-pendant" },
  "l4-pearl-necklace": { author: "delapouite", icon: "pearl-necklace" },
  "l4-navigators-astrolabe": { author: "caro-asercion", icon: "astrolabe" },
  "l5-silver-candelabra": { author: "lorc", icon: "lit-candelabra" },
  "l5-pearl-inlaid-music-box": { author: "delapouite", icon: "locked-box", substitute: true },
  "l5-handful-of-gold-doubloons": { author: "delapouite", icon: "two-coins" },
  "l5-emerald-brooch": { author: "lorc", icon: "emerald", substitute: true },
  "l5-ruby-ring": { author: "lorc", icon: "engagement-ring" },
  "l5-admirals-medal-of-honor": { author: "lorc", icon: "medal" },
  "l6-black-pearl": { author: "delapouite", icon: "oyster-pearl" },
  "l6-bar-of-sunken-bullion": { author: "willdabeast", icon: "gold-bar" },
  "l6-queens-tiara": { author: "delapouite", icon: "tiara" },
  "l6-diamond-necklace": { author: "lorc", icon: "gem-necklace" },
  "l6-chest-of-gold-coins": { author: "skoll", icon: "open-treasure-chest" },
  "l6-royal-jeweled-crown": { author: "delapouite", icon: "jewel-crown" },
};

/** Lobby explainer sample items (not in the deck) share the items/ folder. */
export const SAMPLE_ICONS: Record<string, IconSource> = {
  "sample-rubber-duck": { author: "delapouite", icon: "plastic-duck" },
  "sample-toy-anchor": { author: "lorc", icon: "anchor" },
  "sample-plastic-castle": { author: "lorc", icon: "castle" },
};

export const BOAT_ICON: IconSource = { author: "delapouite", icon: "sailboat" };
export const TANK_ICON: IconSource = { author: "delapouite", icon: "scuba-tanks" };

const AUTHOR_NAMES: Record<string, string> = {
  delapouite: "Delapouite",
  lorc: "Lorc",
  skoll: "Skoll",
  "caro-asercion": "Caro Asercion",
  willdabeast: "Willdabeast",
};

export function iconAuthors(): string[] {
  const keys = new Set<string>([
    BOAT_ICON.author,
    TANK_ICON.author,
    ...Object.values(ITEM_ICONS).map((s) => s.author),
    ...Object.values(SAMPLE_ICONS).map((s) => s.author),
  ]);
  return Array.from(keys)
    .map((k) => AUTHOR_NAMES[k] ?? k)
    .sort((a, b) => a.localeCompare(b));
}

export function iconCreditLine(): string {
  return `Item icons from game-icons.net, CC BY 3.0, by ${iconAuthors().join(", ")}.`;
}
