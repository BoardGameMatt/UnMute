import type { RankAndFilePhase, RankAndFilePlayState, RankTile } from "./types";

export const WRITE_DISPLAY_SECONDS = 60;
export const WRITE_SECONDS = 65;
export const RANK_SECONDS = 180;
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 20;
export const CLUE_MAX_LEN = 250;
export const WRITE_URGENT_SECONDS = 10;
export const PROGRESS_DENOMINATOR = 5;
export const SHARED_SCREEN_NAME = "Shared screen";
export const ROUND_1_NUMBERS = [8, 48, 92] as const;

export function isSharedScreenName(name: string): boolean {
  return name.trim().toLowerCase() === SHARED_SCREEN_NAME.toLowerCase();
}

export type SubjectCategory = "example" | "general_calibration" | "team_behaviors";

export const PERSISTENT_WRITE =
  "Write an example at your number. Qualifiers and adjectives are fair game. No counts, numbers, or measures. Do not say your number.";
export const PERSISTENT_RANK = "Everyone ranks. The facilitator moves the cards.";
export const SPECTATOR_WRITE = "You’re ranking this round. Don’t help with examples.";
export const RANK_CLOCK_COPY =
  "Three minutes to agree. The facilitator moves the cards. Do not say your number.";
export const PHONE_RANK_COPY =
  "Talk to your teammates. The facilitator will put them in order on the shared screen.";

export function displayStorageKey(sessionId: string): string {
  return `unmute.rank-and-file.display.${sessionId}`;
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

export function kForRound(roundIndex: number): number {
  if (roundIndex <= 1) return 3;
  if (roundIndex === 2) return 4;
  if (roundIndex === 3) return 6;
  return 8;
}

export function kCapped(roundIndex: number, n: number): number {
  return Math.min(kForRound(roundIndex), Math.max(0, n));
}

export function dealNumbers(
  count: number,
  random: () => number = Math.random,
  roundIndex = 0
): number[] {
  if (roundIndex <= 1 && count === ROUND_1_NUMBERS.length) {
    return shuffleCopy([...ROUND_1_NUMBERS], random);
  }
  const deck = shuffleCopy(
    Array.from({ length: 99 }, (_, i) => i + 1),
    random
  );
  return deck.slice(0, count);
}

export function pickClueGivers(
  ids: string[],
  turnCounts: Record<string, number>,
  k: number,
  random: () => number = Math.random
): string[] {
  if (k <= 0 || ids.length === 0) return [];
  const take = Math.min(k, ids.length);
  const buckets = new Map<number, string[]>();
  for (const id of ids) {
    const count = turnCounts[id] ?? 0;
    const bucket = buckets.get(count) ?? [];
    bucket.push(id);
    buckets.set(count, bucket);
  }
  const counts = Array.from(buckets.keys()).sort((a, b) => a - b);
  const picked: string[] = [];
  for (const count of counts) {
    const pool = shuffleCopy(buckets.get(count) ?? [], random);
    for (const id of pool) {
      if (picked.length >= take) return picked;
      picked.push(id);
    }
  }
  return picked;
}

export type PackSubject = {
  id: string;
  category: SubjectCategory;
};

export function pickSubject<T extends PackSubject>(
  unused: T[],
  roundIndex: number,
  random: () => number = Math.random
): T | null {
  if (unused.length === 0) return null;
  if (roundIndex <= 1) {
    return unused.find((row) => row.category === "example") ?? unused[0] ?? null;
  }

  const general = unused.filter((row) => row.category === "general_calibration");
  const team = unused.filter((row) => row.category === "team_behaviors");

  const draw = (pool: T[]): T | null =>
    pool.length === 0 ? null : pool[Math.floor(random() * pool.length)] ?? null;

  if (roundIndex >= 2 && roundIndex <= 4) {
    return draw(general) ?? draw(unused);
  }
  if (roundIndex === 5) {
    return draw(team) ?? draw(unused);
  }
  const preferTeam = random() < 0.5;
  const first = preferTeam ? team : general;
  const second = preferTeam ? general : team;
  return draw(first) ?? draw(second) ?? draw(unused);
}

export function validateClue(
  raw: string
): { ok: true; text: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "Write an example." };
  if (trimmed.length > CLUE_MAX_LEN) {
    return { ok: false, error: `Keep it under ${CLUE_MAX_LEN} characters.` };
  }
  if (/\d/.test(trimmed)) {
    return { ok: false, error: "No numbers." };
  }
  if (/[$%]/.test(trimmed)) {
    return { ok: false, error: "No amounts or prices." };
  }
  return { ok: true, text: trimmed };
}

export function isExactOrder(numbers: number[]): boolean {
  if (numbers.length === 0) return false;
  for (let i = 1; i < numbers.length; i++) {
    const prev = numbers[i - 1];
    const next = numbers[i];
    if (prev === undefined || next === undefined || next <= prev) return false;
  }
  return true;
}

export function percentInOrder(hits: number, committed: number): number {
  if (committed <= 0) return 0;
  return Math.round((hits / committed) * 100);
}

export function canWrap(roundIndex: number, unusedCount: number): boolean {
  return roundIndex >= 5 || unusedCount <= 0;
}

export function progressRatio(committedRounds: number): number {
  if (committedRounds <= 0) return 0;
  return Math.min(1, committedRounds / PROGRESS_DENOMINATOR);
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

export function insertDealAt(rail: string[], dealId: string, index: number): string[] {
  const without = rail.filter((id) => id !== dealId);
  const clamped = Math.max(0, Math.min(index, without.length));
  return [...without.slice(0, clamped), dealId, ...without.slice(clamped)];
}

export function emptySlots(count: number): (string | null)[] {
  return Array.from({ length: count }, () => null);
}

export function placeInSlot(
  slots: (string | null)[],
  dealId: string,
  index: number
): (string | null)[] {
  const next = slots.map((id) => (id === dealId ? null : id));
  if (index < 0 || index >= next.length) return next;
  next[index] = dealId;
  return next;
}

export function swapSlots(
  slots: (string | null)[],
  index: number,
  direction: -1 | 1
): (string | null)[] {
  const other = index + direction;
  if (other < 0 || other >= slots.length) return slots;
  const next = [...slots];
  const left = next[index] ?? null;
  next[index] = next[other] ?? null;
  next[other] = left;
  return next;
}

export function returnToTray(slots: (string | null)[], dealId: string): (string | null)[] {
  return slots.map((id) => (id === dealId ? null : id));
}

export function applyRailOrder(
  rail: (RankTile | null)[],
  tray: RankTile[],
  dealIds: (string | null)[]
): { rail: (RankTile | null)[]; tray: RankTile[] } {
  const byId = new Map<string, RankTile>();
  for (const tile of rail) {
    if (tile) byId.set(tile.dealId, tile);
  }
  for (const tile of tray) byId.set(tile.dealId, tile);

  const placed = new Set(dealIds.filter((id): id is string => Boolean(id)));
  const nextRail = dealIds.map((id) => (id ? byId.get(id) ?? null : null));
  const nextTray: RankTile[] = [];
  const seen = new Set<string>();
  for (const tile of tray) {
    if (placed.has(tile.dealId) || seen.has(tile.dealId)) continue;
    seen.add(tile.dealId);
    nextTray.push(tile);
  }
  for (const tile of rail) {
    if (!tile || placed.has(tile.dealId) || seen.has(tile.dealId)) continue;
    seen.add(tile.dealId);
    nextTray.push(tile);
  }
  return { rail: nextRail, tray: nextTray };
}

export function withOptimisticRail(
  state: RankAndFilePlayState,
  dealIds: (string | null)[]
): RankAndFilePlayState {
  const next = applyRailOrder(state.rail, state.tray, dealIds);
  return {
    ...state,
    rail: next.rail,
    tray: next.tray,
    canCommit: next.rail.length > 0 && next.rail.every((tile) => tile !== null),
  };
}

export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), h | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Network-tab contract: numbers only on the clue-giver phone during write. */
export function maySeeDealtNumber(input: {
  phase: RankAndFilePhase;
  isDisplay: boolean;
  isClueGiver: boolean;
}): boolean {
  return input.phase === "write" && input.isClueGiver && !input.isDisplay;
}

/** Named tiles stay off the write payload so locked text cannot leak. */
export function mayExposeNamedTiles(phase: RankAndFilePhase): boolean {
  return phase === "rank" || phase === "reveal" || phase === "scoreboard";
}

/** Miss: team row stays nameless of numbers; truth row carries them. */
export function teamRowShowsNumbers(
  phase: RankAndFilePhase,
  isHit: boolean | null
): boolean {
  return (phase === "reveal" || phase === "scoreboard") && isHit === true;
}
