/**
 * Question draw for a WAO session (spec §9.6).
 * Pinned first, no repeats, difficulty ascending where the pool allows.
 */

export type DrawCandidate = {
  id: string;
  pinned: boolean;
  active: boolean;
  difficulty: number;
};

/**
 * Whether inactive library rows may enter the draw.
 * Production always refuses. Non-production requires the caller to pass
 * includeInactive: true explicitly — never implied.
 */
export function mayDrawInactiveQuestions(
  includeInactive: boolean,
  nodeEnv: string | undefined = process.env.NODE_ENV
): boolean {
  if (!includeInactive) return false;
  return nodeEnv !== "production";
}

function pickRandom<T>(items: readonly T[], random: () => number): T {
  const index = Math.floor(random() * items.length);
  return items[Math.min(index, items.length - 1)]!;
}

/**
 * Choose the next question id from the library pool.
 * Returns null when nothing eligible remains.
 */
export function drawQuestion(
  candidates: readonly DrawCandidate[],
  usedQuestionIds: ReadonlySet<string>,
  options: {
    includeInactive: boolean;
    /** Prior rounds' difficulties; used to prefer ascending difficulty. */
    priorDifficulties?: readonly number[];
    random?: () => number;
    /** Override for tests; defaults to process.env.NODE_ENV. */
    nodeEnv?: string;
  }
): DrawCandidate | null {
  const random = options.random ?? Math.random;
  const allowInactive = mayDrawInactiveQuestions(
    options.includeInactive,
    options.nodeEnv ?? process.env.NODE_ENV
  );

  const eligible = candidates.filter((q) => {
    if (usedQuestionIds.has(q.id)) return false;
    if (!q.active && !allowInactive) return false;
    return true;
  });

  if (eligible.length === 0) return null;

  const pinned = eligible.filter((q) => q.pinned);
  const pool = pinned.length > 0 ? pinned : eligible;

  const prior = options.priorDifficulties ?? [];
  const floor =
    prior.length > 0 ? Math.max(...prior) : Number.NEGATIVE_INFINITY;

  const ascending = pool.filter((q) => q.difficulty >= floor);
  const bandSource = ascending.length > 0 ? ascending : pool;
  const minDifficulty = Math.min(...bandSource.map((q) => q.difficulty));
  const band = bandSource.filter((q) => q.difficulty === minDifficulty);

  return pickRandom(band, random);
}
