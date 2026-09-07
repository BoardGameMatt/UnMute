export const GUESS_SECONDS = 30;

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

export function pickOne<T>(items: T[], random: () => number = Math.random): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(random() * items.length)] ?? null;
}

export function connectedPool(ids: string[], connected: string[]): string[] {
  if (connected.length === 0) return ids;
  return ids.filter((id) => connected.includes(id));
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

export function isAllowedGifUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === "giphy.com" ||
      host.endsWith(".giphy.com") ||
      host === "giphycdn.com" ||
      host.endsWith(".giphycdn.com")
    );
  } catch {
    return false;
  }
}

export function buildRevealOrder<T extends { round: 1 | 2 }>(
  items: T[],
  random: () => number = Math.random
): T[] {
  const round1 = shuffleCopy(
    items.filter((item) => item.round === 1),
    random
  );
  const round2 = shuffleCopy(
    items.filter((item) => item.round === 2),
    random
  );
  return [...round1, ...round2];
}
