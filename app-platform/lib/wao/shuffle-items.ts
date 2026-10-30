/**
 * Per-pair deterministic item order for play and reveal boards.
 * Same items + pairId ⇒ same order on every poll/reconnect.
 */

/** FNV-1a 32-bit over UTF-16 code units (stable across Node/browser). */
function hashStringToSeed(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Mulberry32 — compact seeded PRNG. */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic Fisher–Yates shuffle keyed by pairId.
 * Sorts by id first so DB row order cannot change the result.
 * Does not mutate `items`.
 */
export function shuffleItemsForPair<T extends { id: string }>(
  items: T[],
  pairId: string
): T[] {
  const sorted = [...items].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  );
  const random = mulberry32(hashStringToSeed(pairId));
  for (let i = sorted.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = sorted[i]!;
    sorted[i] = sorted[j]!;
    sorted[j] = tmp;
  }
  return sorted;
}
