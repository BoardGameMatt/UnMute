import {
  GRID_COLS,
  GRID_ROWS,
  GUESS_SECONDS,
  HALL_COL,
  HALL_ROW,
  LETTERS,
  OPENING_CROSS,
  TEAM_DISCUSS_SECONDS,
  TEAM_INTRO_SECONDS,
  type Assignment,
  type BoardOccupant,
  type Cell,
  type LetteredLot,
  type ZoningBoard,
} from "./types";

export function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

export function parseCellKey(key: string): Cell | null {
  const [c, r] = key.split(",");
  const col = Number(c);
  const row = Number(r);
  if (!Number.isInteger(col) || !Number.isInteger(row)) return null;
  return { col, row };
}

export function inBounds(col: number, row: number): boolean {
  return col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS;
}

export function emptyBoard(): ZoningBoard {
  return {
    occupants: {
      [cellKey(HALL_COL, HALL_ROW)]: { kind: "hall" },
    },
  };
}

export function isOccupied(board: ZoningBoard, col: number, row: number): boolean {
  return Boolean(board.occupants[cellKey(col, row)]);
}

const ORTHO: ReadonlyArray<[number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export function legalLots(board: ZoningBoard): Cell[] {
  const seen = new Set<string>();
  const lots: Cell[] = [];
  for (const key of Object.keys(board.occupants)) {
    const cell = parseCellKey(key);
    if (!cell) continue;
    for (const [dc, dr] of ORTHO) {
      const col = cell.col + dc;
      const row = cell.row + dr;
      if (!inBounds(col, row)) continue;
      if (isOccupied(board, col, row)) continue;
      const k = cellKey(col, row);
      if (seen.has(k)) continue;
      seen.add(k);
      lots.push({ col, row });
    }
  }
  lots.sort((a, b) => a.row - b.row || a.col - b.col);
  return lots;
}

export function isLegalLot(board: ZoningBoard, col: number, row: number): boolean {
  return legalLots(board).some((lot) => lot.col === col && lot.row === row);
}

export function letterLots(cells: Cell[]): LetteredLot[] {
  const sorted = [...cells].sort((a, b) => a.row - b.row || a.col - b.col);
  return sorted.map((cell, i) => ({
    letter: LETTERS[i] ?? String.fromCharCode(65 + i),
    col: cell.col,
    row: cell.row,
  }));
}

export function exactMatch(a: Assignment | null | undefined, b: Assignment | null | undefined): boolean {
  if (!a || !b) return false;
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
  if (keys.length === 0) return false;
  for (const key of keys) {
    if (!a[key] || !b[key] || a[key] !== b[key]) return false;
  }
  return true;
}

export function assignmentComplete(assignment: Assignment, k: number): boolean {
  const letters = LETTERS.slice(0, k);
  return letters.every((letter) => Boolean(assignment[letter]));
}

/** Place `buildingId` on `letter`. Occupied letters swap. */
export function moveAssignment(
  assignment: Assignment,
  buildingId: string,
  letter: string
): Assignment {
  const next = { ...assignment };
  const occupant = next[letter];
  const fromLetter = Object.entries(next).find(([, id]) => id === buildingId)?.[0];
  if (fromLetter) delete next[fromLetter];
  if (occupant && occupant !== buildingId && fromLetter) {
    next[fromLetter] = occupant;
  }
  next[letter] = buildingId;
  return next;
}

export function clearAssignmentBuilding(assignment: Assignment, buildingId: string): Assignment {
  const next = { ...assignment };
  for (const [letter, id] of Object.entries(next)) {
    if (id === buildingId) delete next[letter];
  }
  return next;
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

export function pickRandom<T>(items: T[], random: () => number = Math.random): T | null {
  if (items.length === 0) return null;
  const index = Math.floor(random() * items.length);
  return items[index] ?? null;
}

export function pickRotatingRole(
  pool: string[],
  excludeId: string | null,
  alreadyIds: string[],
  random: () => number = Math.random
): string | null {
  return pickExclusiveRole(pool, [excludeId], alreadyIds, random);
}

/**
 * Fair rotating pick that never returns anyone in `excludeIds`.
 * Skips people already in `alreadyIds` until everyone else in the remaining
 * pool has had a turn, then resets (still honoring excludes).
 */
export function pickExclusiveRole(
  pool: string[],
  excludeIds: ReadonlyArray<string | null | undefined>,
  alreadyIds: string[],
  random: () => number = Math.random
): string | null {
  const exclude = new Set(
    excludeIds.filter((id): id is string => typeof id === "string" && id.length > 0)
  );
  const eligible = pool.filter((id) => !exclude.has(id));
  if (eligible.length === 0) return null;
  const already = new Set(alreadyIds);
  const fresh = eligible.filter((id) => !already.has(id));
  const source = fresh.length > 0 ? fresh : eligible;
  return pickRandom(source, random);
}

/**
 * If nobody is marked connected, treat everyone as present (presence is not
 * always wired). Otherwise only connected ids count.
 */
export function livePoolIds(
  members: ReadonlyArray<{ id: string; connected: boolean }>
): string[] {
  const ids = members.map((m) => m.id);
  const live = members.filter((m) => m.connected).map((m) => m.id);
  return live.length > 0 ? live : [...ids];
}

export function drawOpeningCross(
  buildingIds: string[],
  random: () => number = Math.random
): { board: ZoningBoard; consumedIds: string[] } {
  if (buildingIds.length < 4) {
    throw new Error("Need at least four buildings for the opening cross.");
  }
  const drawn = shuffleCopy(buildingIds, random).slice(0, 4);
  const board = emptyBoard();
  OPENING_CROSS.forEach((spot, i) => {
    const id = drawn[i];
    if (!id) return;
    board.occupants[cellKey(spot.col, spot.row)] = { kind: "building", buildingId: id };
  });
  return { board, consumedIds: drawn };
}

export function placeBuildingsOnLots(
  board: ZoningBoard,
  lots: LetteredLot[],
  assignment: Assignment
): ZoningBoard {
  const next: ZoningBoard = { occupants: { ...board.occupants } };
  for (const lot of lots) {
    const buildingId = assignment[lot.letter];
    if (!buildingId) continue;
    next.occupants[cellKey(lot.col, lot.row)] = { kind: "building", buildingId };
  }
  return next;
}

export function occupantAt(board: ZoningBoard, col: number, row: number): BoardOccupant | undefined {
  return board.occupants[cellKey(col, row)];
}

export function consumedBuildingIds(board: ZoningBoard): string[] {
  const ids: string[] = [];
  for (const occ of Object.values(board.occupants)) {
    if (occ.kind === "building") ids.push(occ.buildingId);
  }
  return ids;
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

export function assignmentForViewer(
  viewerId: string,
  zmId: string | null,
  revealed: boolean,
  assignment: Assignment | null
): Assignment | null {
  if (!assignment) return null;
  if (revealed) return assignment;
  if (viewerId === zmId) return assignment;
  return null;
}

export { GUESS_SECONDS, TEAM_DISCUSS_SECONDS, TEAM_INTRO_SECONDS };
