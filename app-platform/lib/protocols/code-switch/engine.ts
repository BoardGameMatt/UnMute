export const WRITE_SECONDS = 30;
export const GUESS_SECONDS = 30;
export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 20;

export type WordBand = "easy" | "medium" | "hard";
/** Stored filter. Player-facing names are Assemble (shared) and Disperse (unique). */
export type RoundType = "shared" | "unique";

const SUFFIXES = ["s", "es", "ed", "ing", "er", "est"] as const;

export function roundTypeLabel(type: RoundType): "Assemble" | "Disperse" {
  return type === "unique" ? "Disperse" : "Assemble";
}

export function roundTypeRule(type: RoundType): string {
  return type === "unique"
    ? "Only clues which are unique among participants will be shown to the guesser"
    : "Only clues provided by more than one participant will be shown to the guesser";
}

export function displayStorageKey(sessionId: string): string {
  return `unmute.code-switch.display.${sessionId}`;
}

export function shuffleCopy<T>(items: T[], random: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = arr[i];
    const b = arr[j];
    if (a === undefined || b === undefined) continue;
    arr[i] = b;
    arr[j] = a;
  }
  return arr;
}

export function normalizeClue(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[''\-–—]/g, "")
    .replace(/[^a-z]/g, "");
}

export function isFormOfTarget(clueNorm: string, targetNorm: string): boolean {
  if (!clueNorm || !targetNorm) return false;
  if (clueNorm === targetNorm) return true;
  const longer = clueNorm.length >= targetNorm.length ? clueNorm : targetNorm;
  const shorter = clueNorm.length >= targetNorm.length ? targetNorm : clueNorm;
  if (!longer.startsWith(shorter)) return false;
  return (SUFFIXES as readonly string[]).includes(longer.slice(shorter.length));
}

export function validateClue(
  raw: string,
  target: string
): { ok: true; normalized: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "Write one word." };
  if (/\s/.test(trimmed)) return { ok: false, error: "One word only." };
  const normalized = normalizeClue(trimmed);
  if (!normalized) return { ok: false, error: "Letters only." };
  if (isFormOfTarget(normalized, normalizeClue(target))) {
    return { ok: false, error: "Not the target or a form of it." };
  }
  return { ok: true, normalized };
}

export function guessMatches(guess: string, target: string): boolean {
  const g = normalizeClue(guess);
  const t = normalizeClue(target);
  return g.length > 0 && g === t;
}

export function filterClues(normalized: string[], type: RoundType): string[] {
  const counts = new Map<string, number>();
  for (const word of normalized) {
    if (!word) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const kept: string[] = [];
  for (const [word, count] of Array.from(counts.entries())) {
    if (type === "shared" && count >= 2) kept.push(word);
    if (type === "unique" && count === 1) kept.push(word);
  }
  return kept;
}

export function bandWeight(band: WordBand, roundIndex: number): number {
  if (band === "easy") return Math.max(0, 6 - roundIndex);
  if (band === "medium") return 3;
  return Math.max(1, roundIndex);
}

export function pickWord<T extends { id: string; band: WordBand }>(
  unused: T[],
  roundIndex: number,
  random: () => number = Math.random
): T | null {
  if (unused.length === 0) return null;
  if (roundIndex === 1) {
    const easy = unused.filter((word) => word.band === "easy");
    const pool = easy.length > 0 ? easy : unused;
    return pool[Math.floor(random() * pool.length)] ?? null;
  }
  const weighted: T[] = [];
  for (const word of unused) {
    const weight = bandWeight(word.band, roundIndex);
    for (let i = 0; i < weight; i++) weighted.push(word);
  }
  if (weighted.length === 0) {
    return unused[Math.floor(random() * unused.length)] ?? null;
  }
  return weighted[Math.floor(random() * weighted.length)] ?? null;
}

export function pickGuesser(
  ids: string[],
  alreadyGuessed: string[],
  connected: string[],
  random: () => number = Math.random
): string | null {
  const present = connected.length > 0 ? ids.filter((id) => connected.includes(id)) : ids;
  if (present.length === 0) return null;
  const remaining = present.filter((id) => !alreadyGuessed.includes(id));
  const pool = remaining.length > 0 ? remaining : present;
  return pool[Math.floor(random() * pool.length)] ?? null;
}

export function pickRoundType(random: () => number = Math.random): RoundType {
  return random() < 0.5 ? "shared" : "unique";
}

export function timerHasExpired(
  startedAtIso: string | null,
  nowMs: number,
  seconds: number
): boolean {
  if (!startedAtIso) return false;
  const start = new Date(startedAtIso).getTime();
  if (Number.isNaN(start)) return false;
  return nowMs >= start + seconds * 1000;
}

export type ShownStat = {
  participantId: string;
  displayName: string;
  clueRounds: number;
  shownCount: number;
  shownRate: number;
};

export function rankShownStats(rows: ShownStat[]): ShownStat[] {
  return [...rows].sort((a, b) => {
    if (b.shownRate !== a.shownRate) return b.shownRate - a.shownRate;
    if (b.shownCount !== a.shownCount) return b.shownCount - a.shownCount;
    return a.displayName.localeCompare(b.displayName);
  });
}

/** Abandoned rounds must not publish the secret word, guess, or hit/miss. */
export function publicRevealFields(input: {
  phase: string;
  endReason: string | null | undefined;
  word: string | null;
  guessText: string | null;
  isHit: boolean | null;
}): {
  abandoned: boolean;
  targetWord: string | null;
  guessText: string | null;
  isHit: boolean | null;
} {
  const abandoned = input.endReason === "abandoned";
  const showReveal =
    !abandoned && (input.phase === "reveal" || input.phase === "scoreboard");
  return {
    abandoned,
    targetWord: showReveal ? input.word : null,
    guessText: showReveal ? input.guessText : null,
    isHit: showReveal ? input.isHit : null,
  };
}
