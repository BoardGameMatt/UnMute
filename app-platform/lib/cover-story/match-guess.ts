/** Guess matching for Cover Story. Normalize then compare to official name + aliases. */

export function normalizeGuess(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function suggestCorrect(
  guess: string,
  officialName: string,
  aliases: string[]
): boolean {
  const needle = normalizeGuess(guess);
  if (!needle) return false;
  if (needle === normalizeGuess(officialName)) return true;
  return aliases.some((alias) => needle === normalizeGuess(alias));
}
